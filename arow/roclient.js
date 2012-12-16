var RO = {};

(function () {
	"use strict";
	var _spec;

	RO.Client = function (url) {
		this.baseUrl = url;
		this.user = {};
		var that = this;
		$.ajax({
			url: url,
			async: false,
			dataType: "json",
			success: function (homepageRepr) {
				_spec = RO.determineSpec(homepageRepr);
				if (_spec === undefined) {
					throw "Error: No matching spec found";
				}
				that.user = {};
				that.services = null;
				that.version = {};
				that.domainTypes = {};
				that.raw = homepageRepr;
	
				//userRepr = jsonGetNow(grepLink(homepageRepr.links, _spec.rels.user).href);
				//buildNavbar();
				//addRepositoriesToNavbar(grepLink(homepageRepr.links, _spec.rels.services), "#repositoryNav");
				//if (typesPackagePrefix !== undefined) {
				//	loadTypes(grepLink(homepageRepr.links, _spec.rels.types), typesPackagePrefix);
				//}
			}
		});
	};

	RO.Client.prototype.getServices = function () {
		if (this.services === null) {
			this.services = [];
			var that = this;
			$.ajax({
				url: firstByRel(this.raw.links, _spec.rels.services).href,
				dataType: "json",
				success: function (servicesRepr) {
					$.each(servicesRepr.value, function () {
						$.ajax({
							url: this.href,
							dataType: "json",
							success: function (serviceRepr) {
								that.services.push(new RO.DomainObject(serviceRepr));
							}
						});
					});
				}
			});
		}
		return this.services;
	};

	RO.Client.prototype.loadServices = function (onSuccess, onError) {
		var that = this;
		this.services = [];
		$.ajax({
			url: firstByRel(this.raw.links, _spec.rels.services).href,
			dataType: "json",
			success: function (servicesRepr) {
				$.each(servicesRepr.value, function (i) {
					$.ajax({
						url: this.href,
						async: false,
						dataType: "json",
						success: function (serviceRepr) {
							that.services.push(new RO.DomainObject(serviceRepr));
						}
					});
				});
				if (onSuccess) {
					onSuccess(that.services);
				}
			},
			error: function(jqXHR, textStatus, errorThrown) {
				if (onError) {
					onError(jqXHR, textStatus, errorThrown);
				} else {
					throw "Error loading services: " + JSON.parse(jqXHR.responseText).message;
				}
			}
		});
	};

	RO.Client.prototype.serviceByTitle = function (title) {
		return firstByTitle(this.services, title);
	}

	RO.DomainObject = function(raw) {
		if (raw !== undefined) {
			this.initFromRaw(raw);
		}
	}
	RO.DomainObject.prototype.initFromRaw = function(raw) {
		this.raw = raw;
		this.href = firstByRel(raw.links,'self').href;
		if (_spec.optionalCapabilities.domainModel === "formal" || _spec.optionalCapabilities.domainModel === "rich") {
			this.description = RO.Model.byUrl(firstByRel(raw.links,'describedby').href);
			this.isService = this.description.isService;
		} else {
			this.isService = raw.extensions.isService;
		}
		this.title = raw.title;
		this.oid = raw.oid;
		var actions = {};
		var properties = {};
		var collections = {};
		var that = this;
		$.each(raw.members, function() {
			if (this.memberType === 'action') {
				if(this.links) {
					actions[this.id] = new RO.Action(that.description, this);
				} else {
					console.log(this.id+' is an action without links...');
				}
			} else if(this.memberType === 'property' && !that.isService) {
				// if the property has disabledReason then there is no modify/clear links, maybe we don't need to follow details link. optional: false means no clear link.
				if (this.disabledReason !== undefined) {
					properties[this.id] = new RO.Property(that.description, this);
				} else {
					properties[this.id] = new RO.Property(that.description, jsonGetNow(firstByRel(this.links, _spec.rels.details).href));
				}
			} else if(this.memberType === 'collection' && !that.isService) {
				collections[this.id] = new RO.Collection(that.description, this);
			}
		});
		this.actions = actions;
		this.properties = properties;
		this.collections = collections;
	};
	RO.DomainObject.prototype.initSummaryFromRaw = function (raw) {
		if (raw.href) {
			this.href = raw.href;
			this.title = raw.title;
			this.oid = raw.href.substring(raw.href.indexOf("/objects/")+9);
		} else {
			this.href = firstByRel(raw.links, "self").href;
			this.title = raw.title;
			this.oid = raw.oid;
		}
	};
	RO.DomainObject.prototype.actionByName = function(name) {
//		return _.select(this.actions, function(action) { return action.name === name})[0];
		return firstByPredicate(this.actions, function (action) {return action.name === name});
	};
	RO.DomainObject.prototype.refreshNow = function () {
		if (this.href) {
			this.initFromRaw(jsonGetNow(this.href));
		}
	}
	RO.DomainObject.prototype.orderedProperties = function () {
		var sortable = [];
		for (var property in this.properties) {
			sortable.push([this.properties[property].memberOrder, this.properties[property]]);
		}
		sortable.sort(function(a, b) {return a[0] - b[0]});
		return $.map(sortable, function (a) {
			return a[1];
		});
	}

	RO.ProtoPersistentObject = function(raw) {
		if (raw !== undefined) {
			this.initFromRaw(raw);
		}
	}
	RO.ProtoPersistentObject.prototype.initFromRaw = function(raw) {
		this.raw = raw;
		this.title = raw.title;
		this.persistLink = firstByRel(raw.links, _spec.rels.persist);
		if (_spec.optionalCapabilities.domainModel === "formal" || _spec.optionalCapabilities.domainModel === "rich") {
			this.description = RO.Model.byUrl(firstByRel(raw.links, "describedby").href);
		}
		var properties = [];
		var that = this;
		$.each(this.persistLink.arguments.members, function() {
			if (this.memberType === 'property') {
				properties.push(new RO.Property(that.description, this));
			}
		});
		this.properties = properties;
	};
	RO.ProtoPersistentObject.prototype.persist = function (onSuccess, onError) {
		var that = this;
		$.each(this.persistLink.arguments.members, function () {
			if (!this.disabledReason || this.disabledReason === "") {
				var persistArg = this;
				var property = firstByPredicate(that.properties, function (property) {
					return property.name === persistArg.id
				});
				this.value = property.value;
			}
		});
		$.ajax({
			url: this.persistLink.href,
			contentType: "application/json; charset=utf-8",
			data: JSON.stringify(this.persistLink.arguments),
			type: this.persistLink.method,
			dataType: "json",
			success: function(resp, status, xhr) {
				if (resp) {
					if (onSuccess) {
						onSuccess(RO.Session.createOrUpdate(resp));
					}
				}
			},
			error: function(jqXHR, textStatus, errorThrown) {
				if (onError) {
					onError(jqXHR, textStatus, errorThrown);
				} else {
					throw "action invocation error: " + JSON.parse(jqXHR.responseText).message;
				}
			}
		});

	};

	RO.DomainObjectList = function(hrefArray) {
		this.elements = [];
		var that = this;
		$.each(hrefArray, function() {
			that.elements.push(RO.Session.createOrUpdateSummary(this));
		});
	}

	RO.Property = function(objectDescription, raw) {
		this.raw = raw;
		this.name = raw.id;
		if (_spec.optionalCapabilities.domainModel === "formal" || _spec.optionalCapabilities.domainModel === "rich") {
			this.description = objectDescription.properties[this.name];
			this.friendlyName = (this.description !== undefined && this.description.friendlyName !== undefined ? this.description.friendlyName : unCamelCase(this.name));
			this.returnType = this.description.type;
			this.format = this.description.format;
			this.maxLength = this.description.maxLength;
		} else {
			this.friendlyName = raw.extensions.friendlyName || unCamelCase(this.name);
			this.returnType = raw.extensions.returnType;
			this.format = raw.extensions.format;
			this.maxLength = raw.extensions.maxLength;
		}
		// TODO: handle simple/formal/selectable
		this.value = raw.value;
		if (this.value && (typeof this.value) === 'object') {
			this.propertyType = "reference";
		} else {
			this.propertyType = "value";
		}
		this.disabledReason = raw.disabledReason;
		if (raw.links) {
			this.href = (firstByRel(raw.links, "self") || firstByRel(raw.links, _spec.rels.details)).href;
			this.modifyLink = firstByRel(raw.links, _spec.rels.modify);
		}
	}
	RO.Property.prototype.canModify = function () {
		return this.modifyLink !== undefined;
	}
	RO.Property.prototype.update = function(value, onSuccess, onError) {
		if(value !== null) {
			var that = this;
			$.ajax({
				url: this.modifyLink.href,
				contentType: "application/json; charset=utf-8",
				data: JSON.stringify({"value":value}),
				type: this.modifyLink.method,
				dataType: "json",
				success: function(resp, status, xhr) {
					that.value = resp.value;
					if (onSuccess !== undefined) {
						onSuccess(resp, status, xhr);
					} else {
						console.log('updated property '+ that.friendlyName + ' to value ' + that.value);
					}
				},
				error: function(jqXHR, textStatus, errorThrown) {
					if (onError !== undefined) {
						onError(jqXHR, textStatus, errorThrown);
					} else {
						throw 'error while updating property ('+that.name+'): '+errorThrown;
					}
				},
				async: !(onSuccess === undefined && onError === undefined)
			});
		}
	}

	RO.Collection = function(objectDescription, raw) {
		this.name = raw.id;
		if (_spec.optionalCapabilities.domainModel === "formal" || _spec.optionalCapabilities.domainModel === "rich") {
			this.description = objectDescription.collections[this.name];
			this.friendlyName = (this.description !== undefined && this.description.friendlyName !== undefined ? this.description.friendlyName : unCamelCase(this.name));
		} else {
			this.friendlyName = raw.extensions.friendlyName || unCamelCase(this.name);
		}
		var that = this;
		if (raw.value !== undefined) {
			this.summaries = [];
			$.each(raw.value, function() {
				that.summaries.push(RO.Session.createOrUpdateSummary(this));
			});
		} else {
			this.href = firstByRel(raw.links, _spec.rels.details).href;
		}
	};
	RO.Collection.prototype.refreshNow  = function () {
		if (this.summaries === undefined) {
			this.loadSummaries();
		}
		$.each(this.summaries, function (i, summary) {
			summary.refreshNow();
		});
	};
	RO.Collection.prototype.loadSummaries = function () {
		if (this.summaries === undefined) {
			this.summaries = [];
			var that = this;
			$.each(jsonGetNow(this.href).value, function () {
				that.summaries.push(RO.Session.createOrUpdateSummary(this));
			});
		}
	}
	RO.Collection.prototype.getSummaries = function () {
		if (this.summaries === undefined) {
			this.loadSummaries();
		}
		return this.summaries;
	}

	RO.Argument = function(id, parameterDef, value) {
		this.id = id;
		this.name = parameterDef.name;
		this.choices = parameterDef.choices;
		this.num = parameterDef.num;
		this.raw = parameterDef;
		this.friendlyName = (parameterDef.extensions && parameterDef.extensions.friendlyName) || parameterDef.name;
		this.value = value;

	}
	RO.Action = function(objectDescription, raw) {
		this.raw = raw;
		this.id = raw.id;
		this.name = raw.id;
		if (_spec.optionalCapabilities.domainModel === "formal" || _spec.optionalCapabilities.domainModel === "rich") {
			this.description = objectDescription.actions[this.id];
			this.friendlyName = (raw.extensions && raw.extensions.friendlyName) || (this.description && this.description.friendlyName) || unCamelCase(this.id);
		} else {
			this.friendlyName = raw.extensions.friendlyName || unCamelCase(this.id);
		}
		this.detailsUrl = (firstByRel(raw.links, "self") || firstByRel(raw.links, _spec.rels.details)).href;
		this.arguments = [];
		// TODO: Is contributedby Isis-specific?
		var contributedByLink = firstByRel(raw.links, "contributedby");
		if (contributedByLink !== undefined) {
			this.contributedby = contributedByLink;
		}
		var that = this;
		var rawInvocation = firstByRel(raw.links, _spec.rels.invoke);
		if (rawInvocation) {
			this.invocationUrl = rawInvocation.href;
			this.method = rawInvocation.method;
			$.each(rawInvocation.arguments, function(key, value) {
				// Isis uses id, RO.NET uses name
				var parameterDef = firstByPredicate(raw.parameters, function (param) { return param.id === key || param.name === key; }),
					argument = new RO.Argument(key, parameterDef, value);
				that.arguments.push(argument);
			});
		} else {
			// action is disabled
		}
	}
	RO.Action.prototype.load = function () {
		if (this.rawInvocation === undefined) {
			var details = jsonGetNow(this.detailsUrl);
			this.rawInvocation = firstByRel(details.links, _spec.rels.invoke);
			if (this.rawInvocation) {
				this.invocationUrl = this.rawInvocation.href;
				this.method = this.rawInvocation.method;
				var that = this;
				$.each(this.rawInvocation.arguments, function(key, value) {
					// Isis uses id, RO.NET uses name
					var parameterDef = firstByPredicate(details.parameters, function (param) { return param.id === key || param.name === key; }),
						argument = new RO.Argument(key, parameterDef, value);
					that.arguments.push(argument);
				});
			} else {
				// action is disabled
			}
		}
	}
	RO.Action.prototype.getArguments = function () {
		if (this.rawInvocation === undefined) {
			this.load();
		}
		return this.arguments;
	}
	RO.Action.prototype.invoke = function(argumentsObject, onSuccess, onError) {
		if (this.rawInvocation === undefined) {
			this.load();
		}
		$.ajax({
			url: this.invocationUrl + (this.method === "GET" && argumentsObject ? "?" + encodeURIComponent(JSON.stringify(argumentsObject)) : ""),
			contentType: "application/json; charset=utf-8",
			data: (this.method !== 'GET' && argumentsObject ? JSON.stringify(argumentsObject) : null),
			type: this.method,
			dataType: "json",
			success: function(resp, status, xhr) {
				if (resp) {
					//Isis.trigger('actionResponseArrived', JSON.parse(resp));
					if (onSuccess) {
						onSuccess(actionResponseArrived(resp));
					}
				}
			},
			error: function(jqXHR, textStatus, errorThrown) {
				if (onError) {
					onError(jqXHR, textStatus, errorThrown);
				} else {
					throw "action invocation error: " + JSON.parse(jqXHR.responseText).message;
				}
			}
		});
	};

	function actionResponseArrived(resp) {
		if (resp[_spec.resultTypeParam] === "list") {
			return new RO.DomainObjectList(resp.result.value);
		} else if ((resp[_spec.resultTypeParam] === "domainobject" || resp[_spec.resultTypeParam] === "object") && (resp.result.extensions.isPersistent === true || resp.result.instanceId !== undefined)) {
			return RO.Session.createOrUpdate(resp.result);
		} else if ((resp[_spec.resultTypeParam] === "domainobject" || resp[_spec.resultTypeParam] === "object") && (resp.result.extensions.isPersistent === false || resp.result.instanceId === undefined)) {
			return new RO.ProtoPersistentObject(resp.result);
		} else {
			throw "Don't know how to handle action result of type: " + resp[_spec.resultTypeParam];
		}
	}

	RO.Session = (function() {
		var objectMap = {},
			buildingObjectMap = {};

		return {
			createOrUpdate: function(raw) {
				var selfLink = firstByRel(raw.links, "self"),
					selfHref = (selfLink !== undefined ? selfLink.href : guidGenerator());
				if(objectMap[selfHref]) {
					if (buildingObjectMap[selfHref]) {
						console.log('already building ' + selfHref);
					} else {
						buildingObjectMap[selfHref] = objectMap[selfHref];
						objectMap[selfHref].initFromRaw(raw);
						delete buildingObjectMap[selfHref];
					}
				} else {
					objectMap[selfHref] = new RO.DomainObject();
					buildingObjectMap[selfHref] = objectMap[selfHref];
					objectMap[selfHref].initFromRaw(raw);
					delete buildingObjectMap[selfHref];
				}
				return objectMap[selfHref];
			},

			createOrUpdateSummary: function (raw) {
				var selfLink = (raw.links !== undefined ? firstByRel(raw.links, "self") : undefined),
					selfHref = (selfLink !== undefined ? selfLink.href : raw.href || guidGenerator());
				if (objectMap[selfHref]) {
					if (buildingObjectMap[selfHref]) {
						console.log("already building " + selfHref);
					} else {
						buildingObjectMap[selfHref] = objectMap[selfHref];
						objectMap[selfHref].initSummaryFromRaw(raw);
						delete buildingObjectMap[selfHref];
					}
				} else {
					objectMap[selfHref] = new RO.DomainObject();
					buildingObjectMap[selfHref] = objectMap[selfHref];
					objectMap[selfHref].initSummaryFromRaw(raw);
					delete buildingObjectMap[selfHref];
				}
				return objectMap[selfHref];
			},

			getObjectByOid: function(oid) {
				if(objectMap[oid]) {
					return objectMap[oid];
				} else {
					throw 'Object with oid '+oid+' not present in session';
				}
			},

			getLinkByOid: function(oid) {
				var obj = objectMap[oid];
				if (obj) {
					return {'href': obj.href, 'title': obj.title};
				} else {
					throw 'Object with oid '+oid+' not present in session';
				}
			}
		};
	})();

	var specs = {
			"0.52": {
				rels: {
					services: "services",
					user: "user",
					types: "types",
					returntype: "returntype",
					invoke: "invoke",
					details: "details",
					modify: "modify",
					update: "modify",
					property: "property",
					action: "action",
					persist: "persist",
					elementtype: "elementtype"
				},
				reprTypes: {
					propertyDescription: "application/json;profile=\"urn:org.restfulobjects/propertydescription\"",
					collectionDescription: "application/json;profile=\"urn:org.restfulobjects/collectiondescription\""
				},
				resultTypeParam: "resulttype",
				propertyType: "type"
			},
			"1.0.0": {
				rels: {
					services: "urn:org.restfulobjects:rels/services",
					user: "urn:org.restfulobjects:rels/user",
					types: "urn:org.restfulobjects:rels/domain-types",
					returntype: "urn:org.restfulobjects:rels/return-type",
					invoke: "urn:org.restfulobjects:rels/invoke",
					details: "urn:org.restfulobjects:rels/details",
					modify: "urn:org.restfulobjects:rels/modify",
					update: "urn:org.restfulobjects:rels/update",
					property: "urn:org.restfulobjects:rels/property",
					action: "urn:org.restfulobjects:rels/action",
					persist: "urn:org.restfulobjects:rels/persist",
					elementtype: "urn:org.restfulobjects:rels/elementtype"
				},
				reprTypes: {
					propertyDescription: "application/json; profile=\"urn:org.restfulobjects:repr-types/property-description\"",
					collectionDescription: "application/json; profile=\"urn:org.restfulobjects:repr-types/collection-description\""
				},
				resultTypeParam: "resultType",
				propertyType: "returnType"
			},
			"1.0": {
				rels: {
					services: "urn:org.restfulobjects:rels/services",
					user: "urn:org.restfulobjects:rels/user",
					types: "urn:org.restfulobjects:rels/domain-types",
					returntype: "urn:org.restfulobjects:rels/return-type",
					invoke: "urn:org.restfulobjects:rels/invoke",
					details: "urn:org.restfulobjects:rels/details",
					modify: "urn:org.restfulobjects:rels/modify",
					update: "urn:org.restfulobjects:rels/update",
					property: "urn:org.restfulobjects:rels/property",
					action: "urn:org.restfulobjects:rels/action",
					persist: "urn:org.restfulobjects:rels/persist",
					elementtype: "urn:org.restfulobjects:rels/elementtype"
				},
				reprTypes: {
					propertyDescription: "application/json; profile=\"urn:org.restfulobjects:repr-types/property-description\"",
					collectionDescription: "application/json; profile=\"urn:org.restfulobjects:repr-types/collection-description\""
				},
				resultTypeParam: "resultType",
				propertyType: "returnType"
			}
		};

	RO.determineSpec = function (homepageRep) {
		var versionLink,
			versionRep,
			specVersion,
			spec;

		versionLink = firstByRel(homepageRep.links, "version") || firstByRel(homepageRep.links, "urn:org.restfulobjects:rels/version");
		if (versionLink != null) {
			versionRep = jsonGetNow(versionLink.href);
			if (versionRep != null) {
				specVersion = versionRep.specVersion;
				if (specVersion != null) {
					spec = specs[specVersion];
					if (spec != null) {
						spec.optionalCapabilities = versionRep.optionalCapabilities;
						//spec.optionalCapabilities.domainModel = "formal";
						return spec;
					}
				}
			}
		}
		return undefined;
	};

	RO.PropertyDescr = function(raw) {
		this.name = raw.id;
		this.friendlyName = raw.friendlyName || raw.extensions.friendlyName;
		this.completeType = firstByRel(raw.links, _spec.rels.returntype).href;
		this.type = this.completeType.substring(1+this.completeType.lastIndexOf('/'));
		this.maxLength = raw.maxLength;
		this.memberOrder = raw.extensions.memberOrder || 999;
		this.optional = (raw.optional !== undefined ? raw.optional : true);
	}

	RO.CollectionDescr = function(raw) {
		this.name = raw.id;
		this.friendlyName = raw.extensions.friendlyName;
		this.completeElementType = firstByRel(raw.links, _spec.rels.elementtype).href;
		this.elementType = this.completeElementType.substring(1+this.completeElementType.lastIndexOf("/"));
	}

	RO.ActionParamDescr = function(raw) {
		this.friendlyName = raw.extensions.friendlyName;
		this.name = raw.name;
		this.optional = raw.optional;
		this.completeType = firstByRel(raw.links, _spec.rels.returntype).href;
		this.type = this.completeType.substring(1+this.completeType.lastIndexOf('/'));
	}

	RO.ActionDescr = function(raw) {
		this.id = raw.id;
		this.friendlyName = raw.extensions.friendlyName;
		this.completeReturnType = firstByRel(raw.links, _spec.rels.returntype).href;
		this.returnType = this.completeReturnType.substring(1+this.completeReturnType.lastIndexOf('/'));
		this.parameters = {};
		var that = this;
		$.each(raw.parameters, function() {
			var param = new RO.ActionParamDescr(jsonGetNow(this.href));
			that.parameters[param.name] = param;
		});
	}

	RO.DomainObjectDescr = function(raw) {
		this.friendlyName = coalesce(raw.friendlyName, raw.extensions.friendlyName);
		this.completeType = firstByRel(raw.links, 'self').href;
		this.type = this.completeType.substring(1+this.completeType.lastIndexOf('/'));
		this.isService = (raw.isService !== undefined && raw.isService === true) || raw.extensions.isService === true;
		this.actions = {};
		this.properties = {};
		this.collections = {};
		var that = this;
		$.each(raw.members, function() {
			if(this.rel === _spec.rels.property && !that.isService) {
				if (startsWith(this.type, _spec.reprTypes.propertyDescription)) {
					var property = new RO.PropertyDescr(jsonGetNow(this.href));
					that.properties[property.name] = property;
				} else if (startsWith(this.type, _spec.reprTypes.collectionDescription)) {
					var collection = new RO.CollectionDescr(jsonGetNow(this.href));
					that.collections[collection.name] = collection;
					// TODO Should these go in a different map?
				}
			} else if (this.rel === _spec.rels.action) {
				// TODO this if is a workaround for an Isis defect (?)
				if (!(this.href.match('/id$')=='/id')) {
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

// Utilities
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

	function startsWith(str, pattern) {
		return str.indexOf(pattern) === 0;
	}
	function firstByRel(links, relStr) {
		return links.filter(function (link) { return startsWith(link.rel, relStr); })[0];
	}

	function firstByTitle(array, title) {
		return firstByPredicate(array, function (obj) { return obj.title === title; });
	}
	function firstByPredicate(objectOrArray, predicate) {
		return filterObjectOrArray(objectOrArray, predicate)[0];
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
	function unCamelCase(str) {
		return str
			// insert a space between lower & upper
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			// space before last upper in a sequence followed by lower
			.replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
			// uppercase the first character
			.replace(/^./, function (str) { return str.toUpperCase(); });
	}

	/**
	 * Just like || but without coercion.
	 */
	function coalesce() {
		for (var i = 0; i < arguments.length; i++) {
			if (arguments[i] !== undefined && arguments[i] !== null) {
				return arguments[i];
			}
		}
		return null;
	}

}());

