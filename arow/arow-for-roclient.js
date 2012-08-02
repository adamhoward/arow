/*
 * A RestfulObjects Workspace
 * 
 * AROW.init
 * defaultHandlers
 * AROW.submitAndRender
 * buildNavbar
 * addServicesToNavbar
 * loadTypes
 * handleDomainObject
 * handleDomainObjectRepresentation
 * handleObjectCollection
 * handleList
 * handleActionInvoke
 * handleActionResult
 * handleProtoPersistentObject
 * renderObjectCollectionAsList
 * renderObjectCollectionAsTable
 * propertyToField
 * renderOpenViewLink
 * convertActionLinksToActionMenuContent
 * addActionMenuToDialog
 */
var AROW = {};
(function () {
	'use strict';
	/*jslint nomen: true, undef: true*/
	/*global $ */

	var _roclient, // Generic RestfulObjects client interface
		customHandlers = [],
		defaultHandlers = [
			// 0.52
			["application/json;profile=\"urn:org.restfulobjects/domainobject\"", handleDomainObjectRepresentation],
			["application/json; profile=\"urn:org.restfulobjects/domainobject\"", handleDomainObjectRepresentation],
//			["application/json;profile=\"urn:org.restfulobjects/list\"", handleListRepresentation],
//			["application/json; profile=\"urn:org.restfulobjects/list\"", handleListRepresentation],
//			["application/json;profile=\"urn:org.restfulobjects/objectcollection\"", handleObjectCollectionRepresentation],
//			["application/json; profile=\"urn:org.restfulobjects/objectcollection\"", handleObjectCollectionRepresentation],
//			["application/json;profile=\"urn:org.restfulobjects/actionresult\"", handleActionResultRepresentation],
//			["application/json; profile=\"urn:org.restfulobjects/actionresult\"", handleActionResultRepresentation],
//			["application/json;profile=\"urn:org.restfulobjects/objectaction\"", handleObjectActionRepresentation],
//			["application/json; profile=\"urn:org.restfulobjects/objectaction\"", handleObjectActionRepresentation],
			// 1.0.0
//			["application/json; profile=\"urn:org.restfulobjects:repr-types/object-action\"", handleObjectActionRepresentation],
//			["application/json; profile=\"urn:org.restfulobjects:repr-types/action-result\"", handleActionResultRepresentation],
			["application/json; profile=\"urn:org.restfulobjects:repr-types/object\"", handleDomainObjectRepresentation],
//			["application/json; profile=\"urn:org.restfulobjects:repr-types/object-collection\"", handleObjectCollectionRepresentation]
		];


	/**
	 * AROW entry point.
	 *
	 * @param {string} baseUrl The url to your RO homepage
	 * @param {Object=} options Map of optional arguments,
	 *     typesPackagePrefix: package name of your domain types,
	 *     iconsMap: map of class names to icon urls
	 */
	AROW.init = function (baseUrl, options) {
		options = (typeof options === "undefined") ? {} : options;
		var typesPackagePrefix = options.typesPackagePrefix;
		AROW.iconsMap = options.iconsMap || {};

		_roclient = new RO.Client(baseUrl);
		_roclient.loadServices(function (servicesArray) {
			buildNavbar();
			addServicesToNavbar(servicesArray, "#repositoryNav");
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
		$('*').live('click.clickmap', function (evt) {
			$("div.arow-action-menu").css("display", "none");
		});
	};

	function loadingStarted() {
		$("#loading").show();
	}
	function loadingCompleted() {
		$("#loading").hide();
	}

	/**
	 * Main AROW controller. Request url and handle result.
	 */
	AROW.submitAndRender = function (urlHref, httpMethod, options) {
		options = (typeof options === "undefined") ? {} : options;
		$.ajax({
			url: urlHref,
			type: httpMethod || "GET",
			dataType: "json",
			data: options.data,
			success: function (json, str, xhr) {
				var contentType = xhr.getResponseHeader("Content-Type"),
					i,
					len,
					handler;

				for (i = 0, len = defaultHandlers.length; i < len; i++) {
					if (startsWith(contentType, defaultHandlers[i][0])) {
						handler = defaultHandlers[i][1];
						break;
					}
				}
				if (!handler) {
					alert("unable to handle response: " + contentType);
					return;
				}
				handler(urlHref, json, xhr, options);
			},
			error: function (jqXHR, textStatus, errorThrown) {
				alert(JSON.parse(jqXHR.responseText).message);
			}
		});
	};


	AROW.registerHandler = function (type, handler) {
		customHandlers.push([type, handler]);
		customHandlers = customHandlers.sort(function (a, b) { return b[0].length - a[0].length; });
	};

	AROW.saveSession = function () {
		var viewsArray = $.map(AROW.views, function (view) {
			var position = $(view.dialog).dialog("option", "position");
			return {"href": view.href, "top": position[1], "left": position[0]};
		});
		localStorage.setItem("AROW.session", JSON.stringify(viewsArray));
	};

	AROW.clearSession = function () {
		localStorage.removeItem("AROW.session");
	};

	//
	// Maintain registry of current views (dialogs)
	//
	AROW.views = {};
	AROW.registerView = function (view) {
		if (view.cid === undefined && view.dialog !== undefined) {
			view.cid = guidGenerator();
			view.dialog.dialog("option", "cid", view.cid);
		}
		AROW.views[view.cid] = view;
	};
	AROW.deregisterView = function (view) {
		delete AROW.views[view.cid];
	};
	function repositionDialog(dialog, options) {
		if (options !== undefined
				&& options.top !== undefined
				&& options.left !== undefined) {
			dialog.dialog("option", "position", [options.left, options.top]);
		}
	}

/////////////////////////////////////////////////////////////////////////
// Navbar
/////////////////////////////////////////////////////////////////////////

	function buildNavbar() {
		var navbar =
			'<div class="navbar navbar-fixed-top">'
			+ '  <div class="navbar-inner">'
			+ '    <div class="container-fluid">'
			+ '      <a href="#" class="brand" title="A RestfulObjects Workspace">AROW</a>'
			+ '      <div class="nav-collapse">'
			+ '        <ul id="repositoryNav" class="nav"></ul>'
			+ '        <ul class="nav pull-right">'
			+ '          <li id="loading" style="color:white;font-size:30px;padding-right:8px;display:none;">...</li>'
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
		//<img style="padding-right:6px; padding-top:9px;" height="20" width="20" src="arow/287.gif" />
		$("body").prepend(navbar);
	}

	function addServicesToNavbar(servicesArray, navElemSelector) {
		$.each(servicesArray, function (i, service) {
			var icon,
				toggle,
				dropdownMenu;
			if (AROW.iconsMap !== undefined
					&& AROW.iconsMap[service.title] !== undefined) {
				icon = $('<img/>').attr("src", AROW.iconsMap[service.title]);
			}
			toggle = $('<li/>')
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
			if (!$.isEmptyObject(service.actions)) {
				dropdownMenu = $("<ul/>").addClass("dropdown-menu");
				$.each(service.actions, function (i, action) {
					$('<li/>')
						.html($('<a/>')
							.attr("href", "#")
							.text(action.friendlyName)
							.click(function () {
								handleActionInvoke(action);
								//AROW.submitAndRender(action.links[0].href);
							})
						)
						.appendTo(dropdownMenu);
				});
				dropdownMenu.appendTo(toggle);
			}
		});
	}


	function propertyToField(property, appendTo, extraParams) {
		var inputId, fieldSpec, input, returntype, startOffDisabled;
		extraParams = (typeof extraParams === "undefined") ? {} : extraParams;
		inputId = extraParams.inputId === undefined ? guidGenerator() : extraParams.inputId;
		$('<label/>')
			.text(property.friendlyName)
			.attr("for", inputId)
			.appendTo(appendTo);
		if (property.propertyType === "reference") {
			return $('<li/>')
			.html("<span>"
					//+ ((iconUrl !== undefined && iconUrl !== null) ? "<img style='height:32px;width:32px;vertical-align:middle;padding-right:4px' src='" + iconUrl + "' />" : "")
					+ property.raw.value.title
					+ "</span>"
					+ "<span class='ui-icon ui-icon-extlink'></span>")
			.css("cursor", "pointer")
			.click(function () {
				$.ajax({
					url: property.raw.value.href,
					type: "GET",
					dataType: "json",
					success: function (resp, status, xhr) {
						handleDomainObject(RO.Session.createOrUpdate(resp));
					}
				})
			})
			.appendTo(appendTo);
		} else {
			if (property.returnType === "org.apache.isis.applib.value.Date") {
				input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.name)
				.attr("value", property.value)
				.datepicker({"dateFormat" : "yymmdd"})
				.appendTo(appendTo);
			} else if (property.format === "date-time") {
				input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.name)
				.attr("value", property.value)
				.datetimepicker({
					timeFormat: "hh:mm:ss.lZ",
					separator: "T",
					showSecond: true,
					dateFormat: "yy-mm-dd",
					hourGrid: 4,
					minuteGrid: 10,
					secondGrid: 10
				})
				.appendTo(appendTo);
				input.datetimepicker("setDate", (new Date(Date.parse(property.value))))
			} else if (property.format === "date") {
				input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.name)
				.attr("value", property.value)
				.datepicker({
					dateFormat: "yy-mm-dd"
				})
				.appendTo(appendTo);
			} else if (property.format === "time") {
				input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.name)
				.attr("value", property.value)
				.timepicker({
					timeFormat: "hh:mm:ss.lZ",
					separator: "T",
					showSecond: true,
					hourGrid: 4,
					minuteGrid: 10,
					secondGrid: 10
				})
				.appendTo(appendTo);
			} else if (property.returnType === "boolean") {
				input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.name)
				.attr("type", "checkbox")
				.attr("checked", property.value === true)
				.appendTo(appendTo);
			} else if ((property.maxLength !== undefined && property.maxLength > 64) || (property.value != null && property.value.length > 64)) {
				input = $('<textarea/>')
				.attr("id", inputId)
				.attr("name", property.name)
				.attr("value", property.value)
				.attr("cols", "32")
				.attr("rows", "3")
				.appendTo(appendTo);
			} else {
				input = $('<input/>')
				.attr("id", inputId)
				.attr("name", property.name)
				.attr("value", property.value)
				.appendTo(appendTo);
			}
			startOffDisabled = extraParams.startOffDisabled === undefined ? false : extraParams.startOffDisabled;
			if (startOffDisabled === true) {
				input.addClass("disabled");
			}
			return input;
		}
	}

	function loadTypes(typesLink, typesPackagePrefix) {
		var typeListRepr = jsonGetNow(typesLink.href),
			myDomainTypes = typeListRepr.values.filter(function (typeLink) {
				return startsWith(typeLink.href.substring(1 + typeLink.href.lastIndexOf('/')), typesPackagePrefix);
			}),
			i,
			len;
		for (i = 0, len = myDomainTypes.length; i < len; i++) {
			RO.Model.byUrl(myDomainTypes[i].href);
		}
	}

/////////////////////////////////////////////////////////////////////////
//
// Functions to handle to the many RO response types by creating dialogs.
//
/////////////////////////////////////////////////////////////////////////

	function handleActionInvoke(action, options) {
		if (action.getArguments().length > 0) {
			var form = $('<form/>'),
				fieldset = $('<fieldset/>').appendTo(form),
				ol = $('<ol/>').appendTo(fieldset),
				dialog,
				openArguments = false;
			$.each(action.getArguments(), function (i, arg) {
				var li,
					select;
				if (arg.value !== undefined && arg.value !== null && arg.value.value !== null) {
					$("<input/>")
						.attr("type", "hidden")
						.attr("name", arg.id)
						.attr("value", JSON.stringify(arg.value))
						.appendTo(fieldset);
				} else if (arg.choices !== undefined && arg.choices.length > 0) {
					openArguments = true;
					li = $('<li/>').appendTo(ol);
					$('<label/>').text(arg.friendlyName).appendTo(li);
					select = $('<select/>').attr("name", arg.id).appendTo(li);
					$.each(arg.choices, function (i, choice) {
						$('<option/>')
							.attr("value", JSON.stringify(choice))
							.html(choice.title)
							.appendTo(select);
					});
				} else {
					openArguments = true;
					li = $('<li/>').appendTo(ol);
					$('<label/>').text(arg.friendlyName).appendTo(li);
					$('<input/>')
						.attr("name", arg.id)
						.appendTo(li);
				}
			});
			if (openArguments === false) {
				var jsonForm = $(form).serializeArray(),
				reduced = jsonForm.reduce(function (a, b) { a[b.name] = (startsWith(b.value, "{") ? JSON.parse(b.value) : b.value); return a; }, {});
				action.invoke(reduced, handleActionResult, handleError);
			} else {
				dialog = $('<div/>').html(form).dialog({
					title: action.friendlyName,
					buttons: [
						{
							text: 'Ok',
							click: function () {
								var jsonForm = $(form).serializeArray(),
									reduced = jsonForm.reduce(function (a, b) { a[b.name] = (startsWith(b.value, "{") ? JSON.parse(b.value) : b.value); return a; }, {});
								action.invoke(reduced, handleActionResult, handleError);
								$(this).dialog('close');
							}
						}
					]
				});
				repositionDialog(dialog, options);

				var guid = guidGenerator();
				dialog.dialog("option", "cid", guid);
//				AROW.registerView({"cid" : guid, "href" : urlHref, "dialog" : dialog});
			}
		} else {
			action.invoke(null, handleActionResult, handleError);
			//AROW.submitAndRender(invokeLink.href, invokeLink.method, options);
		}
	}

	function handleActionResult(actionResult) {
		if (actionResult instanceof RO.DomainObjectList) {
			handleList(actionResult);
		} else if (actionResult instanceof RO.DomainObject) {
			handleDomainObject(actionResult);
		} else if (actionResult instanceof RO.ProtoPersistentObject) {
			handleProtoPersistentObject(actionResult);
		}
	}

	function handleError(jqXHR, textStatus, errorThrown) {
		alert(JSON.parse(jqXHR.responseText).message);
	}

	function handleList(domainObjectList) {
		var ul = $('<ul/>'),
			//iconUrl = determineIconUrl(domainObjectList),
			length = domainObjectList.elements.length,
			iconUrl,
			dialog;

		$.each(domainObjectList.elements, function (i, element) {
			renderOpenViewLink(element.title, element.href, iconUrl).appendTo(ul);
		});

		dialog = $('<div/>').html(ul).dialog({
			title: length + (length === 1 ? ' object' : ' objects'),
			width: 'auto'
			//height: window.innerHeight - 70,
		});

		if (dialog[0].offsetHeight > (window.innerHeight - 60)) {
			dialog.dialog("option", "height", window.innerHeight - 60);
			dialog.dialog("option", "position", "bottom");
		}

		//repositionDialog(dialog, options);

		//AROW.registerView({dialog: dialog, href: urlHref});
	}

	function handleDomainObjectRepresentation(urlHref, json, xhr, options) {
		var domainObject = RO.Session.createOrUpdate(json);
		handleDomainObject(domainObject);
	}

	function handleDomainObject(domainObject, dialogOptions) {
		var form = $('<form/>'),
			dialog = $('<div/>').html(form).dialog({
				width: 'auto',
				height: 'auto'
			});
			//domainObjectDescrLink = grepLink(json.links, "describedby"),
			//domainObjectDescrHref = domainObjectDescrLink === undefined ? undefined : domainObjectDescrLink.href;

		if (!$.isEmptyObject(domainObject.properties)) {
			var propertiesFieldset = $('<fieldset/>').appendTo(form);
			$('<legend/>').text("Properties").appendTo(propertiesFieldset);
			// value properties
			$.each(domainObject.orderedProperties(), function (i, property) {
				var input = propertyToField(property, propertiesFieldset, {startOffDisabled: true});
				if (property.canModify() && property.propertyType === "value") {
					input
					.css("cursor", "text")
					.click(function (event) {
						$(this).removeClass("disabled");
					})
					.blur(function (event) {
						$(this).addClass("disabled");
					})
					.change(function (event) {
						var value = (event.target.type === "checkbox" ? event.target.checked : event.target.value);
						property.update(value, function () { alert("modified " + property.name)});
					});
				}
			});
		}

		// collections
		if (!$.isEmptyObject(domainObject.collections)) {
			var collectionsFieldset = $("<fieldset/>").appendTo(form);
			$("<legend/>").text("Collections").appendTo(collectionsFieldset);
			$.each(domainObject.collections, function (i, collection) {
				return $('<li/>')
				.html("<span>"
						//+ ((iconUrl !== undefined && iconUrl !== null) ? "<img style='height:32px;width:32px;vertical-align:middle;padding-right:4px' src='" + iconUrl + "' />" : "")
						+ collection.friendlyName
						+ "</span>"
						+ "<span class='ui-icon ui-icon-extlink'></span>")
						.css("cursor", "pointer")
						.click(function () {
							handleObjectCollection(collection);
						})
						.appendTo(collectionsFieldset);
			});
		}

		// actions
		if (!$.isEmptyObject(domainObject.actions)) {
			var actionMenuContent = convertActionsToActionMenuContent(domainObject.actions);
			addActionMenuToDialog(actionMenuContent, dialog);
		}

		var dialogTitle = $('<span/>').text(domainObject.title);

//		var domainIconUrl = determineIconUrl(json);
//		if (domainIconUrl !== null) {
//			var icon = $('<img/>').attr("src", domainIconUrl);
//			dialogTitle = $('<span/>').addClass("arow-dialog-title")
//				.html(icon.after($('<span/>').text(json.title)));
//		}

//		dialogTitle.draggable({appendTo : "body", helper : "clone", zIndex : 99999, containment : "document"});

//		var dialog = $('<div/>').html(form).dialog({
//			title: dialogTitle,
//			width: 'auto',
//			height: 'auto'
//		});

		dialog.dialog("option", "title", dialogTitle.html());
		if (dialog[0].offsetHeight > (window.innerHeight - 60)) {
			dialog.dialog("option", "height", window.innerHeight - 60);
			dialog.dialog("option", "position", "bottom");
		}

		repositionDialog(dialog, dialogOptions);

//		AROW.registerView({dialog: dialog, href: urlHref});
	}

	function handleObjectCollection(objectCollection, dialogOptions) {
		var ul,
			dialog,
			actionMenuContent,
			dialogTitle,
			viewAsTableAction,
			viewAsListAction;

		// Default: view collection as list
		ul = renderObjectCollectionAsList(objectCollection);
		var div = $("<div/>");
		ul.appendTo(div);

		dialogTitle = objectCollection.friendlyName;
		//dialogTitle = objectCollectionRepr.extensions.pluralName || determineFriendlyName(objectCollectionRepr) + " for " +grepLink(objectCollectionRepr.links, "up").title;

		dialog = $('<div/>').html(div).dialog({
			title: dialogTitle,
			width: 'auto'
			//height: window.innerHeight - 70,
		});

		// Add actions to toggle view as list or table
		// TODO: Support addto action
		actionMenuContent = $('<ul/>');
		viewAsTableAction = $('<li/>')
			.text("View as Table")
			.click(function () {
				var table = renderObjectCollectionAsTable(objectCollection);
				dialog.find("div").html(table);
				viewAsListAction.css("display", "block");
				viewAsTableAction.css("display", "none");
			})
			.appendTo(actionMenuContent);
		viewAsListAction = $("<li/>")
			.text("View as List")
			.css("display", "none")
			.click(function () {
				var list = renderObjectCollectionAsList(objectCollection);
				dialog.find("div").html(list);
				viewAsTableAction.css("display", "block");
				viewAsListAction.css("display", "none");
			})
			.appendTo(actionMenuContent);
		addActionMenuToDialog(actionMenuContent, dialog);

		// Reposition dialog if top/left options exist
		repositionDialog(dialog, dialogOptions);

		if (dialog[0].offsetHeight > (window.innerHeight - 60)) {
			dialog.dialog("option", "height", window.innerHeight - 60);
			dialog.dialog("option", "position", "bottom");
		}

		// Register dialog for saved session
//		AROW.registerView({dialog: dialog, href: urlHref});
	}

	function handleProtoPersistentObject(protoPersistentObject) {
		var form = $('<form/>'),
			fieldset = $("<fieldset/>").appendTo(form),
			ol = $("<ol/>").appendTo(fieldset),
			dialog;
		$.each(protoPersistentObject.properties, function () {
			var li = $("<li/>").appendTo(ol);
			if (this.disabledReason) {
				$("<label/>").text(this.friendlyName).appendTo(li);
				$("<input/>")
					.attr("disabled", "true")
					.attr("value", (this.value !== undefined && this.value !== null ? (this.value.title !== undefined ? this.title : this.value) : ""))
					.appendTo(li);
			} else {
				propertyToField(this, li);
			}
		});
		dialog = $('<div/>').html(form).dialog({
			title: protoPersistentObject.title,
			buttons: [
				{
					text: 'Persist',
					click: function () {
						var jsonForm = $(form).serializeArray();
						$.each(jsonForm, function () {
							var that = this;
							var property = filterObjectOrArray(protoPersistentObject.properties, function (property) {
								return property.name === that.name;
							})[0];
							property.value = this.value;
						});
						protoPersistentObject.persist(handleActionResult);
						$(this).dialog('close');
					}

				}
			]
		});
		//repositionDialog(dialog, options);
	}

/////////////////////////////////////
/////////////////////////////////////
// old stuff
/////////////////////////////////////
/////////////////////////////////////
	function oldHandleDomainObjectRepresentation(urlHref, json, xhr, options) {
		var form = $('<form/>'),
			actions,
			domainObjectDescrLink = grepLink(json.links, "describedby"),
			domainObjectDescrHref = domainObjectDescrLink === undefined ? undefined : domainObjectDescrLink.href;

		if (!json.serviceId) {
			var propertiesFieldset = $('<fieldset/>').appendTo(form);
			$('<legend/>').text("Properties").appendTo(propertiesFieldset);
			// value properties
			var valueProperties = filterObjectOrArray(json.members, function (obj) {
				return obj.memberType === "property" && (!obj.value || !obj.value.href);
			});
			$.each(valueProperties, function (i, valueProperty) {
				var input = appendInputField(domainObjectDescrHref, valueProperty, propertiesFieldset, {startOffDisabled: true, propertySpec: valueProperty.extensions});
				var objectUpdateLink = grepLink(json.links, _spec.rels.update);
				if (objectUpdateLink !== undefined) {
					var objectUpdateArguments = objectUpdateLink['arguments'];
					if (objectUpdateArguments !== undefined) {
						var objectUpdateArgMembers = objectUpdateArguments.members;
						// 0.52: arguments has members array of objects, 1.0.0: arguments is map of propertyName -> attributes
						if (grepParameter(objectUpdateArgMembers || objectUpdateArguments, valueProperty.id)) {
							input
							.css("cursor", "text")
							.click(function (event) {
								$(this).removeClass("disabled");
							})
							.blur(function (event) {
								$(this).addClass("disabled");
							})
							.change(function (event) {
								var propertyDetailsLink = grepLink(grepParameter(json.members, valueProperty.id).links, _spec.rels.details);
								$.ajax({
									url: propertyDetailsLink.href,
									dataType: "json",
									success: function (data, textstatus, jqXHR) {
										var modifyLink = grepLink(data.links, _spec.rels.modify);
										$.ajax({
											url: modifyLink.href,
											type: modifyLink.method,
											dataType: "json",
											data: JSON.stringify({"value" : event.target.type === "checkbox" ? event.target.checked : event.target.value}),
											success: function () {
												alert("modified");
											}
										});
									}
								});
							});
						}
					}
				}
			});

			// reference properties
			var referenceProperties = filterObjectOrArray(json.members, function (obj) {
				return obj.memberType === "property" && obj.value && obj.value.href;
			});
			$.each(referenceProperties, function (i, referenceProperty) {
				renderOpenViewLink(
					"<strong>" + unCamelCase(referenceProperty.id) + "</strong>: " + referenceProperty.value.title,
					referenceProperty.value.href
				).appendTo(propertiesFieldset);
			});

			// collections
			var collections = filterByMemberType(json.members, "collection");
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
			actions = filterByMemberType(json.members, "action");
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

		if (dialog[0].offsetHeight > (window.innerHeight - 60)) {
			dialog.dialog("option", "height", window.innerHeight - 60);
			dialog.dialog("option", "position", "bottom");
		}

		repositionDialog(dialog, options);

		if (!json.serviceId && actions.length > 0) {
			var actionMenuContent = convertActionLinksToActionMenuContent(actions);
			addActionMenuToDialog(actionMenuContent, dialog);
		}

		AROW.registerView({dialog: dialog, href: urlHref});
	}

/////////////////////////////////////////////////////////////////////////
//
// Functions to render individual elements to be used in a dialog.
//
////////////////////////////////////////////////////////////////////////

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

	function renderObjectCollectionAsList(objectCollection) {
		var ul = $('<ul/>'),
			//iconUrl = determineIconUrl(json),
			iconUrl;

		$.each(objectCollection.getSummaries(), function (i, summary) {
			renderOpenViewLink(summary.title, summary.href, iconUrl).appendTo(ul);
		});
		return ul;
	}

	function renderObjectCollectionAsTable (objectCollection) {
		var table = $('<table/>'),
			cols = {},
			headerRow = $('<tr/>').appendTo(table),
			rows;

		objectCollection.refreshNow();

		$.each(objectCollection.getSummaries(), function (i, domainObject) {
			$.each(domainObject.orderedProperties(), function (j, property) {
				cols[property.name] = "";
			});
		});
		cols["Actions"] = "";
		$.each(cols, function (col, val) {
			$('<th/>').text(unCamelCase(col)).appendTo(headerRow);
		});
		$.each(objectCollection.getSummaries(), function (i, domainObject) {
			var tr = $('<tr/>').appendTo(table);
			$.each(cols, function (col) {
				var value, td;
				if (col === "Actions") {
					td = $('<td/>').appendTo(tr);
					$('<span/>')
						.addClass("ui-icon ui-icon-extlink")
						.attr("title", "Open")
						.click(function () {
							AROW.submitAndRender(domainObject.href);
						})
						.appendTo(td);
//					if (removeFromLink !== undefined) {
//						$('<span/>')
//							.addClass("ui-icon ui-icon-trash")
//							.attr("title", "Delete")
//							.click(function () {
//								alert("implement delete");
//							})
//							.appendTo(td);
//					}
				} else {
					value = domainObject.properties[col].value;
					if ($.isPlainObject(value) && value.href !== undefined && value.href !== null) {
						td = $('<td/>').appendTo(tr);
						$('<span/>')
							.html(value.title + "<span class='ui-icon ui-icon-extlink'></span>")
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

	function convertActionsToActionMenuContent(actions) {
		var actionMenuContent = $('<ul/>');
		$.each(actions, function (i, action) {
			//TODO: handle contributed actions properly
//			if (action.contributedby !== undefined && action.contributedby !== null) {
//				var contributedbyHeader = $('<li/>')
//					.addClass("contributedby")
//					.text(contributedby.title)
//					.appendTo(actionMenuContent);
//				$('<li/>')
//					.text(unCamelCase(action.id))
//					.click(function (event) {
//						handleActionInvoke(action);
//						var invokeLink = grepLink(detailsRepr.links, _spec.rels.invoke);
//						if (invokeLink.method === "GET") {
//							var href = invokeLink.href + "?" + encodeURIComponent(JSON.stringify(invokeLink["arguments"]));
//							AROW.submitAndRender(href, invokeLink.method);
//						} else {
//							AROW.submitAndRender(invokeLink.href, invokeLink.method, {"data" : JSON.stringify(invokeLink["arguments"])});
//						}
//					})
//					.appendTo($('<ul/>').appendTo(contributedbyHeader));
//			} else {
				$('<li/>')
					.text(unCamelCase(action.name)) // TODO: contributed actions need description
					.click(function () {
						handleActionInvoke(action);
					})
					.appendTo(actionMenuContent);
//			}
		});

		return actionMenuContent;
	}

	function addActionMenuToDialog(actionMenuContent, dialog) {
		var actionMenu,
			actionMenuTrigger;

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

/////////////////////////////////////////////////////////////////////////
//
// Functions for finding things in the json.
//
/////////////////////////////////////////////////////////////////////////

	function grepLink(links, relStr) {
		return $.grep(links, function (v) { return startsWith(v.rel, relStr); })[0];
	}
	function grepParameter(parameters, paramId) {
		if ($.isPlainObject(parameters)) {
			return parameters[paramId];
		}
		return $.grep(parameters, function (v) { return v.id === paramId; })[0];
	}
	function firstByName(arrayOfObjects, name) {
		return arrayOfObjects.filter(function (obj) { return obj.name === name; })[0];
	}

	function determineIconUrl(json) {
		var domainType = determineDomainType(json);

		if (domainType === undefined || AROW.iconsMap[domainType] === undefined) {
			return null;
		} else {
			return AROW.iconsMap[domainType];
		}
	}

/////////////////////////////////////////////////////////////////////////
//
// Generic utilities.
//
/////////////////////////////////////////////////////////////////////////

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

	function filterByMemberType(objOrArray, memberType) {
		return filterObjectOrArray(objOrArray, memberTypePredicate(memberType));
	}

	function memberTypePredicate(memberType) {
		return function (obj) {
			return obj.memberType === memberType;
		}
	}

	function filterObjectOrArray(objOrArray, predicate) {
		var filtered = [],
			key;
		for (key in objOrArray) {
			if (predicate(objOrArray[key])) {
				filtered.push(objOrArray[key]);
			}
		}
		return filtered;
	}

})();
