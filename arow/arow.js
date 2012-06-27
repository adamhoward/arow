// RestfulObjects model
var RO = {};
(function () {

	function jsonGetNow(url) {
		var result;
		$.ajax({
			async: false,
			url: url,
			dataType: 'json',
			success: function (resp, status, xhr) {
				result = resp;
			},
			error: function (jqXHR, textStatus, error) {
				throw textStatus + ':' + error;
			}
		});
		return result;
	}

	function firstByRel(links, relStr) {
		return links.filter(function (link) { return link.rel === relStr; })[0];
	}

	RO.PropertyDescr = function(raw) {
		this.name = raw.id;
		this.friendlyName = raw.extensions.friendlyName;
		if(raw.memberType === 'property') {
			this.completeType = firstByRel(raw.links, 'returntype').href;
			this.type = this.completeType.substring(1+this.completeType.lastIndexOf('/'));
			this.maxLength = raw.maxLength;
		} else {
			alert(this.friendlyName+' is een ongekend membertype ('+raw.memberType+')');
		}
	}
	
	RO.CollectionDescr = function(raw) {
		this.name = raw.id;
		this.friendlyName = raw.extensions.friendlyName;
	}
	
	RO.ActionParamDescr = function(raw) {
		this.friendlyName = raw.extensions.friendlyName;
		this.name = raw.name;
		this.optional = raw.optional;
		this.completeType = firstByRel(raw.links, 'returntype').href;
		this.type = this.completeType.substring(1+this.completeType.lastIndexOf('/'));
	}
	
	RO.ActionDescr = function(raw) {
		this.id = raw.id;
		this.friendlyName = raw.extensions.friendlyName;
		this.completeReturnType = firstByRel(raw.links, 'returntype').href;
		this.returnType = this.completeReturnType.substring(1+this.completeReturnType.lastIndexOf('/'));
		this.parameters = {};
		var that = this;
		$.each(raw.parameters, function() {
			var param = new RO.ActionParamDescr(jsonGetNow(this.href));
			that.parameters[param.name] = param;
		});
	}
	
	RO.DomainObjectDescr = function(raw) {
		this.friendlyName = raw.extensions.friendlyName;
		this.completeType = firstByRel(raw.links, 'self').href;
		this.type = this.completeType.substring(1+this.completeType.lastIndexOf('/'));
		this.actions = {};
		this.properties = {};
		var that = this;
		$.each(raw.members, function() {
			if(this.rel === 'property') {
				
				if(this.type === 'application/json;profile="urn:org.restfulobjects/propertydescription"') {
					var property = new RO.PropertyDescr(jsonGetNow(this.href));
					that.properties[property.name] = property;
				} else if(this.type === 'application/json;profile="urn:org.restfulobjects/collectiondescription"') {
					//property = new Isis.CollectionDescr(Isis.jsonGet(this.href));
					// TODO Should these go in a different map?
				}
				
			} else if(this.rel === 'action') {
				// TODO this if is a workaround for an Isis defect (?)
				if(!(this.href.match('/id$')=='/id')) {
					var actionRaw = new RO.ActionDescr(jsonGetNow(this.href));
					that.actions[actionRaw.id] = actionRaw;
				}
			} else {
				//alert("Unsupported member type: "+this.rel);
			}
		});
	}
	
	RO.Model = (function(){
		var model = {};
		model.byUrl = function(url) {
			if(!this[url]) {
				this[url] = new RO.DomainObjectDescr(jsonGetNow(url)); 
			}
			return this[url];
		}
		return model;
	})();
	
}());

// A RestfulObjects Workspace
var AROW = {};
(function () {
	'use strict';

	/**
	 * Get JSON synchronously.
	 */
	function jsonGetNow(url) {
		var result;
		$.ajax({
			async: false,
			url: url,
			dataType: 'json',
			success: function (resp, status, xhr) {
				result = resp;
			},
			error: function (jqXHR, textStatus, error) {
				throw textStatus + ':' + error;
			}
		});
		return result;
	}

	//
	// Generic helper functions
	//

	function unCamelCase(str) {
		return str
			// insert a space between lower & upper
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			// space before last upper in a sequence followed by lower
			.replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
			// uppercase the first character
			.replace(/^./, function (str) { return str.toUpperCase(); });
	}

	function guidGenerator() {
		var S4 = function () {
			return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
		};
		return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
	}

	function endsWith(str, pattern) {
		var d = str.length - pattern.length;
		return d >= 0 && str.lastIndexOf(pattern) === d;
	}

	function startsWith(str, pattern) {
		return str.indexOf(pattern) === 0;
	}

	//
	// Find things in the json
	//

	function grepLink(links, relStr) {
		return $.grep(links, function (v) { return v.rel === relStr; })[0];
	}

	function grepParameter(parameters, paramId) {
		return $.grep(parameters, function (v) { return v.id === paramId; })[0];
	}

	function determineDomainType(json) {
		if (json.memberType === "collection") {
			var describedby = jsonGetNow(grepLink(json.links, "describedby").href);
			var elementtypeLink = grepLink(describedby.links, "elementtype");
			return elementtypeLink.href.substring(elementtypeLink.href.indexOf("/domainTypes/") + "/domainTypes/".length);
		} else {
			var elementtypeLink = grepLink(json.links, "elementtype");
			if (elementtypeLink !== undefined) {
				return elementtypeLink.href.substring(elementtypeLink.href.indexOf("/domainTypes/") + "/domainTypes/".length);
			}
			var describedbyLink = grepLink(json.links, "describedby");
			return describedbyLink.href.substring(describedbyLink.href.indexOf("/domainTypes/") + "/domainTypes/".length);
		}
	}

	function determineIconUrl(json) {
		var domainType = determineDomainType(json);

		if (domainType === undefined || AROW.iconsMap[domainType] === undefined) {
			return null;
		} else {
			return AROW.iconsMap[domainType];
		}
	}

	function repositionDialog(dialog, options) {
		if (options !== undefined
				&& options.top !== undefined
				&& options.left !== undefined) {
			dialog.dialog("option", "position", [options.left,options.top]);
		}
	}

	//
	// Maintain registry of current views (dialogs)
	//

	AROW.views = {};
	AROW.registerView = function(view) {
		AROW.views[view.cid] = view;
	}
	AROW.deregisterView = function(view) {
		delete AROW.views[view.cid];
	}

	//
	// Functions to render individual elements to be used
	// in a dialog.
	//

	function renderOpenViewLink(text, link, iconUrl) {
		return $('<li/>')
			.html("<span>"
					+ ((iconUrl !== undefined && iconUrl !== null) ? "<img style='height:32px;width:32px;vertical-align:middle;padding-right:4px' src='" + iconUrl + "' />" : "")
					+ text
					+ "</span>"
					+ "<span class='ui-icon ui-icon-extlink'></span>")
			.css("cursor", "pointer")
			.click(function () {
				AROW.submitAndRender(link);
			});
	}

	function appendInputField(domainTypeHref, property, appendTo, extraParams) {
		var inputId, fieldSpec, input, returntype, startOffDisabled, propertySpec;
		extraParams = (typeof extraParams === "undefined") ? {} : extraParams;
		inputId = extraParams.inputId === undefined ? guidGenerator() : extraParams.inputId;
		$('<label/>')
			.text(unCamelCase(property.id))
			.attr("for", inputId)
			.appendTo(appendTo);
		var model = RO.Model.byUrl(domainTypeHref);
		for (var key in model.properties) {
			if (key === property.id) {
				propertySpec = model.properties[key];
				break;
			}
		}
//		if (extraParams.fieldSpecLink !== undefined) {
//			//fieldSpec = jsonGetNow(extraParams.fieldSpecLink.href);
//			$.ajax({
//				url: extraParams.fieldSpecLink.href,
//				async: false,
//				success: function (data2) {
//					fieldSpec = data2;
//				}
//			});
//		} else {
//			$.ajax({
//				url: grepLink(property.links, "details").href,
//				async: false,
//				success: function (data) {
//					//fieldSpec = jsonGetNow(grepLink(data.links, "describedby").href);
//					$.ajax({
//						url: grepLink(data.links, "describedby").href,
//						async: false,
//						success: function (data2) {
//							fieldSpec = data2;
//						}
//					});
//				}
//			});
//		}
//		returntype = grepLink(fieldSpec.links, "returntype");
//		if (returntype !== undefined && endsWith(returntype.href, "org.apache.isis.applib.value.Date")) {
		if (propertySpec.type === "org.apache.isis.applib.value.Date") {
			input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.id)
				.attr("value", property.value)
				.datepicker({"dateFormat" : "yymmdd"})
				.appendTo(appendTo);
		} else if (propertySpec.type === "boolean") {
			input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.id)
				.attr("type", "checkbox")
				.attr("checked", property.value === true)
				.appendTo(appendTo);
		} else if (propertySpec.maxLength !== undefined && propertySpec.maxLength > 64) {
			input = $('<textarea/>')
				.attr("id", inputId)
				.attr("name", property.id)
				.attr("value", property.value)
				.attr("cols", "32")
				.attr("rows", "3")
				.appendTo(appendTo);
		} else {
			input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.id)
				.attr("value", property.value)
				.appendTo(appendTo);
		}
		startOffDisabled = extraParams.startOffDisabled === undefined ? false : extraParams.startOffDisabled;
		if (startOffDisabled === true) {
			input.addClass("disabled");
		}
		return input;
	}

	function renderObjectCollectionAsList(json) {
		var ul = $('<ul/>'),
			items = json.value,
			iconUrl = determineIconUrl(json);

		$.each(items, function (i, item) {
			renderOpenViewLink(item.title, item.href, iconUrl).appendTo(ul);
		});
		return ul;
	}

	function renderObjectCollectionAsTable(json) {
		var items = json.value,
			removeFromLink = grepLink(json.links, "removefrom"),
			table = $('<table/>'),
			cols = {},
			headerRow = $('<tr/>').appendTo(table),
			rows;

		rows = $.map(items, function (item) {
			return jsonGetNow(item.href);
		});
		$.each(rows, function (i, row) {
			$.each(row.members, function (j, member) {
				if (member.memberType === "property") {
					cols[member.id] = "";
				}
			});
		});
		cols["Actions"] = "";
		$.each(cols, function (col, val) {
			$('<th/>').text(unCamelCase(col)).appendTo(headerRow);
		});
		$.each(rows, function (i, row) {
			var tr = $('<tr/>').appendTo(table);
			$.each(cols, function (col) {
				var value, td;
				if (col === "Actions") {
					td = $('<td/>').appendTo(tr);
					$('<span/>')
						.addClass("ui-icon ui-icon-extlink")
						.attr("title", "Open")
						.click(function () {
							AROW.submitAndRender(grepLink(row.links, "self").href);
						})
						.appendTo(td);
					if (removeFromLink !== undefined) {
						$('<span/>')
							.addClass("ui-icon ui-icon-trash")
							.attr("title", "Delete")
							.click(function () {
								alert("implement delete");
							})
							.appendTo(td);
					}
				} else {
					value = grepParameter(row.members, col).value;
					if ($.isPlainObject(value) && value.href !== undefined && value.href !== null) {
						td = $('<td/>').appendTo(tr);
						$('<span/>')
							.text(value.title)
							.css("cursor", "pointer")
							.click(function () {
								AROW.submitAndRender(value.href);
							})
							.appendTo(td);
					} else {
						$('<td/>').text(value).appendTo(tr);
					}
				}
			});
		});
		return table;
	}

	function addActionMenuToDialog(actionMenuContent, dialog) {
		var actionMenu, actionMenuTrigger;

		actionMenu = $('<div/>')
			.html(actionMenuContent)
			.addClass("arow-action-menu");

		actionMenuTrigger = $('<span/>')
			.text("\u00BB")
			.addClass("arow-action-menu-trigger")
			.attr("title", "Actions")
			.click(function (evt) {
				evt.stopPropagation();
				if (actionMenu.css("display") === "block") {
					actionMenu.css("display", "none");
				} else {
					actionMenu
						.css("position", "absolute")
						.css("top", this.offsetTop + this.offsetParent.offsetTop + this.offsetParent.offsetParent.offsetTop - 9)
						.css("left", this.offsetLeft + this.offsetParent.offsetLeft + this.offsetParent.offsetParent.offsetLeft + 20)
						.css("display", "block")
						.css("z-index", parseInt($(this.offsetParent.offsetParent).css("z-index"), 10) + 1);
				}
			});
		actionMenu.insertBefore(dialog.parent());
		actionMenuTrigger.appendTo(dialog);

		dialog.bind("dialogclose", function (evt, ui) {
			AROW.deregisterView({"cid" : $(this).dialog("option", "cid"), "dialog" : $(this)});
			$(this).remove();
			actionMenu.remove();
		});
	}

	//
	// Functions to create dialogs
	//
	
	function handleDomainObjectRepresentation(urlHref, json, xhr, options) {
		var form = $('<form/>'),
			actions;

		if (!json.serviceId) {
			var propertiesFieldset = $('<fieldset/>').appendTo(form);
			$('<legend/>').text("Properties").appendTo(propertiesFieldset);
			// value properties
			var valueProperties = json.members.filter(function (item) {
				return item.memberType === "property" && (!item.value || !item.value.href);
			});
			$.each(valueProperties, function (i, valueProperty) {
				var input = appendInputField(grepLink(json.links, "describedby").href, valueProperty, propertiesFieldset, {startOffDisabled : true});
				if (grepParameter(grepLink(json.links, "modify")['arguments'].members, valueProperty.id)) {
					input
						.css("cursor", "text")
						.click(function (event) {
							$(this).removeClass("disabled");
						})
						.blur(function (event) {
							$(this).addClass("disabled");
						})
						.change(function (event) {
							var propertyDetailsLink = grepLink(grepParameter(json.members, valueProperty.id).links, "details");
							$.ajax({
								url: propertyDetailsLink.href,
								success: function (data, textstatus, jqXHR) {
									var modifyLink = grepLink(data.links, "modify");
									$.ajax({
										url: modifyLink.href,
										type: modifyLink.method,
										data: JSON.stringify({"value" : event.target.type === "checkbox" ? event.target.checked : event.target.value}),
										success: function () {
											alert("modified");
										}
									});
								}
							});
						});
				}
			});

			// reference properties
			var referenceProperties = json.members.filter(function (item) {
				return item.memberType === "property" && item.value && item.value.href;
			});
			$.each(referenceProperties, function (i, referenceProperty) {
				renderOpenViewLink(
					unCamelCase(referenceProperty.id) + ": " + referenceProperty.value.title,
					referenceProperty.value.href
				).appendTo(propertiesFieldset);
			});

			// collections
			var collections = json.members.filter(function (item) {
				return item.memberType === "collection";
			});
			if (collections.length > 0) {
				var collectionsFieldset = $('<fieldset/>').appendTo(form);
				$('<legend/>').text("Collections").appendTo(collectionsFieldset);
				$.each(collections, function (i, collection) {
					renderOpenViewLink(
						unCamelCase(collection.id),
						collection.links[0].href
					).appendTo(collectionsFieldset);
				});
			}

			// actions
			actions = json.members.filter(function (item) {
				return item.memberType === "action";
			});
//			if (actions.length > 0) {
//				var actionFieldset = $("<fieldset/>").appendTo(form);
//				$("<legend/>").text("Actions").appendTo(actionFieldset);
//				$.each(actions, function (i, action) {
//					$("<button/>")
//						.text(unCamelCase(action.id))
//						.click(function (event) {
//							event.stopPropagation();
//							event.preventDefault();
//							AROW.submitAndRender(action.links[0].href);
//						})
//						.button()
//						.appendTo(actionFieldset);
//					$("<br/>").appendTo(actionFieldset);
//				});
//			}
		} else {
			// actions
			actions = json.members.filter(function (item) {
				return item.memberType === "action";
			});
			//$(ul).css("padding", "0");
			$.each(actions, function (i, action) {
				$('<button/>')
					.text(unCamelCase(action.id))
					.click(function (event) {
						event.stopPropagation();
						event.preventDefault();
						AROW.submitAndRender(action.links[0].href);
					})
					.button()
					.appendTo(form);
				$('<br/>').appendTo(form);
			});
		}

		var dialogTitle = $('<span/>').text(json.title);

		var domainIconUrl = determineIconUrl(json);
		if (domainIconUrl !== null) {
			var icon = $('<img/>').attr("src", domainIconUrl);
			dialogTitle = $('<span/>').addClass("arow-dialog-title")
				.html(icon.after($('<span/>').text(json.title)));
		}

		dialogTitle.draggable({appendTo : "body", helper : "clone", zIndex : 99999, containment : "document"});

		var dialog = $('<div/>').html(form).dialog({
			title: dialogTitle,
			width: 'auto',
			height: 'auto'
		});

		repositionDialog(dialog, options);

		if (!json.serviceId && actions.length > 0) {
			var actionMenuContent = $('<ul/>');
			$.each(actions, function (i, action) {
				var details = jsonGetNow(grepLink(action.links, "details").href);
				var contributedbyLink = grepLink(details.links, "contributedby");
				if (contributedbyLink) {
					var contributedbyHeader = $('<li/>')
						.addClass("contributedby")
						.text(contributedbyLink.title)
						.appendTo(actionMenuContent);
					$('<li/>')
						.text(unCamelCase(action.id))
						.click(function (event) {
							var invokeLink = grepLink(details.links, "invoke");
							if (invokeLink.method === "GET") {
								var href = invokeLink.href + "?" + encodeURIComponent(JSON.stringify(invokeLink["arguments"]));
								AROW.submitAndRender(href, invokeLink.method);
							} else {
								AROW.submitAndRender(invokeLink.href, invokeLink.method, {"data" : JSON.stringify(invokeLink["arguments"])});
							}
						})
						.appendTo($('<ul/>').appendTo(contributedbyHeader));
				} else {
					$('<li/>')
					.text(unCamelCase(action.id))
					.click(function (event) {
						AROW.submitAndRender(action.links[0].href);
					})
					.appendTo(actionMenuContent);
				}
			});
			addActionMenuToDialog(actionMenuContent, dialog);
		}

		var guid = guidGenerator();
		dialog.dialog("option", "cid", guid);
		AROW.registerView({"cid" : guid, "href" : urlHref, "dialog" : dialog});
	}

	function handleListRepresentation(urlHref, json, xhr, options) {
		var ul = $('<ul/>');
		var items = json.value;
		var iconUrl = determineIconUrl(json);
		$.each(items, function (i, item) {
			renderOpenViewLink(item.title, item.href, iconUrl).appendTo(ul);
		});

		var dialog = $('<div/>').html(ul).dialog({
			title: "List",
			width: 'auto',
			height: 'auto'
		});

		repositionDialog(dialog, options);

		var guid = guidGenerator();
		dialog.dialog("option", "cid", guid);
		AROW.registerView({"cid" : guid, "href" : urlHref, "dialog" : dialog});
	}

	function handleObjectCollectionRepresentation(urlHref, json, xhr, options) {
		var table,
			dialog,
			actionMenuContent;

		table = renderObjectCollectionAsTable(json);

		dialog = $('<div/>').html(table).dialog({
			title: unCamelCase(json.id) + " for " + grepLink(json.links, "up").title,
			width: 'auto',
			height: 'auto'
		});

		actionMenuContent = $('<ul/>');
		$('<li/>')
			.text("View as List")
			.click(function () {
				var list = renderObjectCollectionAsList(json);
				$('<div/>').html(list).dialog({
					title: unCamelCase(json.id) + " for " + grepLink(json.links, "up").title,
					width: 'auto',
					height: 'auto'
				});
			})
			.appendTo(actionMenuContent);

		repositionDialog(dialog, options);
		addActionMenuToDialog(actionMenuContent, dialog);

		var guid = guidGenerator();
		dialog.dialog("option", "cid", guid);
		AROW.registerView({"cid" : guid, "href" : urlHref, "dialog" : dialog});
	}

	function handleObjectActionRepresentation(urlHref, json, xhr, options) {
		var invokeLink = grepLink(json.links, "invoke");
		if (invokeLink['arguments'] && !$.isEmptyObject(invokeLink['arguments'])) {
			var form = $('<form/>');
			var fieldset = $('<fieldset/>').appendTo(form);
			var ol = $('<ol/>').appendTo(fieldset);
			$.each(invokeLink['arguments'], function (key, val) {
				var li = $('<li/>').appendTo(ol);
				var argParam = grepParameter(json.parameters, key);
				if (argParam !== undefined && argParam.choices) {
					$('<label/>').text(unCamelCase(key)).appendTo(li);
					var select = $('<select/>').attr("name", key).appendTo(li);
					$.each(argParam.choices, function (i, choice) {
						$('<option/>')
							.attr("value", JSON.stringify(choice))
							.html(choice.title)
							.appendTo(select);
					});
				} else {
					$('<label/>').text(unCamelCase(key)).appendTo(li);
					$('<input/>')
						.attr("name", key)
						.appendTo(li);
				}
			});
			var dialog = $('<div/>').html(form).dialog({
				title: unCamelCase(json.id),
				buttons: [
					{
						text: 'Ok',
						click: function () {
							var jsonForm = $(form).serializeArray();
							$.each(jsonForm, function (i, jsonInput) {
								$.each(invokeLink['arguments'], function (key, val) {
									if (jsonInput.name === key) {
										if (form.find(":input[name=" + key + "]")[0].nodeName === "SELECT") {
											var selectedVal = form.find(":input[name=" + key + "] :selected").val();
											var argParam = grepParameter(json.parameters, key);
											$.each(argParam.choices, function (i, choice) {
												if (selectedVal === JSON.stringify(choice)) {
													invokeLink['arguments'][key] = choice;
												}
											});
										} else {
											invokeLink['arguments'][key] = jsonInput.value;
										}
									}
								});
							});
							$.ajax({
								url: invokeLink.href,
								type: invokeLink.method,
								data: JSON.stringify(invokeLink['arguments']),
								success: function (data, textStatus, jqXHR) {
									alert(textStatus);
								},
								statusCode: {
									406: function (jqXHR, textStatus, errorThrown) {
										alert(JSON.parse(jqXHR.responseText).message);
									}
								}
							});
							$(this).dialog('close');
						}

					}
				]
			});
			repositionDialog(dialog, options);

			var guid = guidGenerator();
			dialog.dialog("option", "cid", guid);
			AROW.registerView({"cid" : guid, "href" : urlHref, "dialog" : dialog});
		} else {
			AROW.submitAndRender(invokeLink.href, invokeLink.method, options);
		}
	}

	function handleNewDomainObjectRepresentation(urlHref, json, xhr, options) {
		var form = $('<form/>');
		var persistLink = grepLink(json.links, "persist");
		if (persistLink === undefined) {
			handleDomainObjectRepresentation(urlHref, json, xhr, options);
		}
		var describedbyLink = grepLink(persistLink['arguments'].links, "describedby");
//		var describedby;
//		$.ajax({
//			url: describedbyLink.href,
//			type: describedbyLink.method,
//			async: false,
//			success: function (data) {
//				describedby = data;
//			}
//		});
		$.each(persistLink['arguments'].members, function (i, persistArg) {
			if (persistArg.disabledReason) {
				$('<label/>').text(unCamelCase(persistArg.id)).appendTo(form);
				$('<input/>')
					.attr("disabled", "true")
					.attr("value", (persistArg.value !== null ? persistArg.value.title : ""))
					.appendTo(form);
			} else {
				//var fieldSpecLink = $.grep(describedby.members, function (v) { return endsWith(v.href, "/" + persistArg.id); })[0];
				appendInputField(describedbyLink.href, persistArg, form, {"inputId": persistArg.id});
			}
		});
		var dialog = $('<div/>').html(form).dialog({
			title: json.title,
			buttons: [
				{
					text: 'Persist',
					click: function () {
						var jsonForm = $(form).serializeArray();
						var persistLink = grepLink(json.links, "persist");
						$.each(jsonForm, function (i, jsonInput) {
							$.each(persistLink['arguments'].members, function (i, persistArg) {
								if (jsonInput.name === persistArg.id) {
									persistArg.value = jsonInput.value;
								}
							});
						});
						$.ajax({
							url: persistLink.href,
							type: persistLink.method,
							data: JSON.stringify(persistLink['arguments']),
							success: function (data, textStatus, jqXHR) {
								alert(textStatus);
							}
						});
						$(this).dialog('close');
					}

				}
			]
		});
		repositionDialog(dialog, options);

// Can't register NewDomainObject views because I can't determine http method.
// Is it always POST?
//		var guid = guidGenerator();
//		dialog.dialog("option", "cid", guid);
//		AROW.registerView({"cid" : guid, "href" : urlHref, "dialog" : dialog});
	}

	AROW.actionResultHandlers = {
		"object": handleDomainObjectRepresentation,
		"list": handleListRepresentation,
		"domainobject": handleNewDomainObjectRepresentation
	};

	function handleActionResultRepresentation(urlHref, json, xhr, options) {
		var resultType = json.resulttype;
		var handler = AROW.actionResultHandlers[resultType];
		if (!handler) {
			alert("unable to handle result type");
			return;
		}
		handler(urlHref, json.result, xhr, options);
	}

	var customHandlers = [];
	AROW.registerHandler = function (type, handler) {
		customHandlers.push([type, handler]);
		customHandlers = customHandlers.sort(function (a, b) { return b[0].length - a[0].length; });
	};

	var defaultHandlers = [
		["application/json;profile=\"urn:org.restfulobjects/domainobject\"", handleDomainObjectRepresentation],
		["application/json; profile=\"urn:org.restfulobjects/domainobject\"", handleDomainObjectRepresentation],
		["application/json;profile=\"urn:org.restfulobjects/list\"", handleListRepresentation],
		["application/json; profile=\"urn:org.restfulobjects/list\"", handleListRepresentation],
		["application/json;profile=\"urn:org.restfulobjects/objectcollection\"", handleObjectCollectionRepresentation],
		["application/json; profile=\"urn:org.restfulobjects/objectcollection\"", handleObjectCollectionRepresentation],
		["application/json;profile=\"urn:org.restfulobjects/actionresult\"", handleActionResultRepresentation],
		["application/json; profile=\"urn:org.restfulobjects/actionresult\"", handleActionResultRepresentation],
		["application/json;profile=\"urn:org.restfulobjects/objectaction\"", handleObjectActionRepresentation],
		["application/json; profile=\"urn:org.restfulobjects/objectaction\"", handleObjectActionRepresentation]
	];

	AROW.submitAndRender = function (urlHref, httpMethod, options) {
		options = options || {};
		$.ajax({
			url: urlHref,
			type: httpMethod || "GET",
			dataType: 'json',
			data: options.data,
			success: function (json, str, xhr) {
				var contentType = xhr.getResponseHeader("Content-Type");
				var describedbyLink = grepLink(json.links, "describedby");
				var handlerType = describedbyLink === undefined ? contentType : contentType + ",domaintype=\"" + determineDomainType(json) + "\"";
				var allHandlers = customHandlers.concat(defaultHandlers);
				var handler;
				for (var i = 0, len = allHandlers.length; i < len; i++) {
					if (startsWith(handlerType, allHandlers[i][0])) {
						handler = allHandlers[i][1];
						break;
					}
				}
				if (!handler) {
					alert("unable to handle response");
					return;
				}
				handler(urlHref, json, xhr, options);
			}
		});
	};

	AROW.saveSession = function () {
		var viewsArray = $.map(AROW.views, function (view) {
			var position = $(view.dialog).dialog("option", "position");
			return {"href":view.href, "top":position[1], "left":position[0]};
		});
		localStorage.setItem("AROW.session", JSON.stringify(viewsArray));
	};

	AROW.clearSession = function () {
		localStorage.removeItem("AROW.session");
	};

	function buildNavbar() {
		var navbar =
			'<div class="navbar navbar-fixed-top">'
			+ '  <div class="navbar-inner">'
			+ '    <div class="container-fluid">'
			+ '      <a href="#" class="brand" title="A RestfulObjects Workspace">AROW</a>'
			+ '      <div class="nav-collapse">'
			+ '        <ul id="repositoryNav" class="nav"></ul>'
			+ '        <ul class="nav pull-right">'
			+ '          <li>'
			+ '            <form action="" class="navbar-search">'
			+ '              <input type="text" placeholder="Search (inactive)" class="search-query span2">'
			+ '            </form>'
			+ '          </li>'
			+ '          <li class="divider-vertical"></li>'
			+ '          <li class="dropdown">'
			+ '            <a data-toggle="dropdown" class="dropdown-toggle"><span id="userName">sven</span><b class="caret"></b></a>'
			+ '            <ul class="dropdown-menu">'
			+ '              <li><a href="#" onclick="AROW.saveSession()">Save session</a></li>'
			+ '              <li><a href="#" onclick="AROW.clearSession()">Clear session</a></li>'
			+ '              <li><a href="#"><em>Options</em><span class="ui-icon ui-icon-gear"></span></a></li>'
			+ '              <li><a href="#"><em>Logout</em></a></li>'
			+ '            </ul>'
			+ '          </li>'
			+ '        </ul>'
			+ '      </div>'
			+ '    </div>'
			+ '  </div>'
			+ '</div>';

		$("body").prepend(navbar);
	}

	function addRepositoriesToNavbar(servicesLink, navElemSelector) {
		$.ajax({
			url: servicesLink.href,
			success : function(services) {
				$.each(services.value, function (i, service) {
					var icon;
					if (AROW.iconsMap !== undefined
							&& AROW.iconsMap[service.title] !== undefined) {
						icon = $('<img/>').attr("src", AROW.iconsMap[service.title]);
					}
					var toggle = $('<li/>')
						.addClass("dropdown")
						.html($('<a/>')
								.attr("data-toggle", "dropdown")
								.addClass("dropdown-toggle")
								.attr("href", "#")
								.html(icon !== undefined
										? icon.after(service.title + "<b class='caret'></b>")
										: service.title + "<b class='caret'></b>")
						)
						.appendTo($(navElemSelector));
					$.ajax({
						url: service.href,
						success: function (service) {
							var actions = service.members.filter(function (member) {
								return member.memberType === "action";
							});
							if (actions !== undefined) {
								var dropdownMenu = $('<ul/>').addClass("dropdown-menu");
								$.each(actions, function (i, action) {
									$('<li/>')
										.html($('<a/>')
											.attr("href", "#")
											.text(unCamelCase(action.id))
											.click(function () {
												AROW.submitAndRender(action.links[0].href);
											})
									)
									.appendTo(dropdownMenu);
								});
								dropdownMenu.appendTo(toggle);
							}
						}
					});
				});
			}
		});
	}

	function readVersion(versionLink) {
		
	}

	function loadTypes(typesLink, typesPackagePrefix) {
		var types = jsonGetNow(typesLink.href);
		var myDomainTypes = types.values.filter(function (type) {
			return startsWith(type.href.substring(1+type.href.lastIndexOf('/')), typesPackagePrefix);
		});
		for (var i = 0, len = myDomainTypes.length; i < len; i++) {
			RO.Model.byUrl(myDomainTypes[i].href);
		}
	}

	AROW.init = function (baseUrl, options) {
		options = (typeof options === "undefined") ? {} : options;
		var typesPackagePrefix = options.typesPackagePrefix
		AROW.iconsMap = options.iconsMap;

		$.ajax({
			url: baseUrl,
			success: function (json) {
				var user = jsonGetNow(grepLink(json.links, "user").href);
				readVersion(grepLink(json.links, "version"));
				buildNavbar();
				addRepositoriesToNavbar(grepLink(json.links, "services"), "#repositoryNav");
				if (typesPackagePrefix !== undefined) {
					loadTypes(grepLink(json.links, "types"), typesPackagePrefix);
				}
			}
		});

		// jQuery Dialog Defaults
		$.extend($.ui.dialog.prototype.options, {
			close: function (evt, ui) {
				AROW.deregisterView({"cid" : $(this).dialog("option", "cid"), "dialog" : $(this)});
				$(this).remove();
			},
			dragStart: function (evt, ui) {
				$("div.arow-action-menu").css("display", "none");
			}
		});
		$('*').live('click.clickmap', function(evt) {
			$("div.arow-action-menu").css("display", "none");
		});
	}

}());
