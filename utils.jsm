// Many times I can't use 'this' to refer to the owning var's context, so I'm setting 'this' as 'self', 
// I can use 'self' from within functions, timers and listeners easily and to bind those functions to it as well
this.self = this;

// Quick method to load subscripts into the context of "this"
this.moduleAid = {
	loader: mozIJSSubScriptLoader,
	_loadedModules: [{
		path: "resource://"+objPathString+"/modules/utils.jsm",
		unload: function() {
			while(moduleAid._loadedModules.length > 1) {
				moduleAid.unload(moduleAid._loadedModules[1].path);
			}
			timerAid.cancelAll();
			listenerAid.clean();
			observerAid.clean();
		},
		vars: ['hasAncestor', 'hideIt', 'modifyFunction', 'setWatchers', 'listenerAid', 'aSync', 'timerAid', 'prefAid', 'observerAid', 'privateBrowsingAid', 'styleAid', 'moduleAid', 'self'],
		version: '1.0.2'
	}],
	_moduleVars: {},
	
	loadIf: function(aPath, anIf) {
		if(anIf) {
			this.load(aPath);
		} else {
			this.unload(aPath);
		}
	},
	
	load: function(aPath) {
		if(this.loaded(aPath)) {
			return false;
		}
		
		this.loader.loadSubScript(aPath, self);
		
		var module = {
			path: aPath,
			unload: (self.UNLOADMODULE) ? UNLOADMODULE : null,
			vars: (self.VARSLIST) ? VARSLIST : null,
			version: (self.VERSION) ? VERSION : null
		};
		this._loadedModules.push(module);
		
		if(self.VARSLIST) {
			this.createVars(VARSLIST);
		}
		if(self.LOADMODULE) {
			LOADMODULE();
		}
		
		delete self.VARSLIST;
		delete self.LOADMODULE;
		delete self.UNLOADMODULE;
		delete self.VERSION;
		return true;
	},
	
	unload: function(aPath) {
		for(var i = 0; i < this._loadedModules.length; i++) {
			if(this._loadedModules[i].path == aPath) {
				if(this._loadedModules[i].unload) {
					this._loadedModules[i].unload();
				}
				if(this._loadedModules[i].vars) {
					for(var o = 0; o < this._loadedModules[i].vars.length; o++) {
						this.deleteVar(this._loadedModules[i].vars[o]);
					}
				}
				this._loadedModules.splice(i, 1);
				return true;
			}
		}
		return false;
	},
	
	loaded: function(aPath) {
		for(var i = 0; i < this._loadedModules.length; i++) {
			if(this._loadedModules[i].path == aPath) {
				return true;
			}
		}
		return false;
	},
	
	createVars: function(aList) {
		for(var i=0; i<aList.length; i++) {
			if(this._moduleVars[aList[i]]) {
				this._moduleVars[aList[i]]++;
			} else {
				this._moduleVars[aList[i]] = 1;
			}
		}
	},
	
	deleteVar: function(aVar) {
		if(this._moduleVars[aVar]) {
			this._moduleVars[aVar]--;
			if(this._moduleVars[aVar] == 0) {
				delete self[aVar];
				delete this._moduleVars[aVar];
			}
			return true;
		}
		return false;
	}
};
delete self.mozIJSSubScriptLoader; // self removes unnecessary javascript warnings that show up in the console
moduleAid.createVars(moduleAid._loadedModules[0].vars);

// Checks if aNode decends from aParent
this.hasAncestor = function(aNode, aParent, aWindow) {
	if(!aNode || !aParent) { return false; };
	
	if(aNode == aParent) { return true; }
	
	var ownDocument = aNode.ownerDocument || aNode.document;
	if(ownDocument && ownDocument == aParent) { return true; }
	if(aNode.compareDocumentPosition && (aNode.compareDocumentPosition(aParent) & aNode.DOCUMENT_POSITION_CONTAINS)) { return true; }
	
	var browsers = aParent.getElementsByTagName('browser');
	for(var i=0; i<browsers.length; i++) {
		if(hasAncestor(aNode, browsers[i].contentDocument, browsers[i].contentWindow)) { return true; }
	}
	
	if(!aWindow) { return false; }
	for(var i=0; i<aWindow.frames.length; i++) {
		if(hasAncestor(aNode, aWindow.frames[i].document, aWindow.frames[i])) { return true; }
	}
	return false;
};

// in theory this should collapse whatever I want
this.hideIt = function(aNode, show) {
	if(!show) {
		aNode.setAttribute('collapsed', 'true');
	} else {
		aNode.removeAttribute('collapsed');
	}
};

// allows me to modify a function quickly from within my scripts
// Note to self, by using the Function() method to create functions I'm priving them from their original context,
// that is, while inside a function created by that method in a module loaded by moduleAid I can't call 'subObj' (as in 'mainObj.subObj') by itself as I normally do,
// I have to either use 'mainObj.subObj' or 'this.subObj'; I try to avoid this as that is how I'm building my modularized add-ons, 
// so I'm using eval, at least for now until I find a better way to implement this functionality.
this.modifyFunction = function(aOriginal, aArray) {
	var newCode = aOriginal.toString();
	for(var i=0; i < aArray.length; i++) {
		newCode = newCode.replace(aArray[i][0], aArray[i][1].replace("{([objName])}", objName));
	}
	
	eval('var ret = ' + newCode + ';');
	return ret;
};

// This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
this.setWatchers = function(obj) {
	// Properties part, works by replacing the get and set accessor methods of a property with custom ones
	if(	typeof(obj) != 'object' 
		|| typeof(obj.addPropertyWatcher) != 'undefined'
		|| typeof(obj.removePropertyWatcher) != 'undefined'
		|| typeof(obj.propertiesWatched) != 'undefined') 
	{ 
		return; 
	}
	
	// Monitors 'prop' property of object, calling a handler function 'handler' when it is changed
	obj.addPropertyWatcher = function (prop, handler) {
		if(typeof(this.propertiesWatched[prop]) == 'undefined') {
			this.propertiesWatched[prop] = {};
			this.propertiesWatched[prop].handlers = new Array();
			this.propertiesWatched[prop].handlers.push(handler);
		
			this.propertiesWatched[prop].value = this[prop];
			
			if (delete this[prop]) { // can't watch constants
				this.__defineGetter__(prop, function () { return this.propertiesWatched[prop].value; });
				this.__defineSetter__(prop, function (newval) {	
					for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
						try { this.propertiesWatched[prop].handlers[i].call(this, prop, this.propertiesWatched[prop].value, newval); }
						catch(ex) {
							var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
							consoleService.logStringMessage(ex);
						}
					}
					return this.propertiesWatched[prop].value = newval;
				});
			};
		}
		else {
			var add = true;
			for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
				// Have to compare using toSource(), it won't work if I just compare handlers for some reason
				if(this.propertiesWatched[prop].handlers[i].toSource() == handler.toSource()) {
					add = false;
				}
			}
			if(add) {
				this.propertiesWatched[prop].handlers.push(handler);
			}
		}
	};
	
	// Removes handler 'handler' for property 'prop'
	obj.removePropertyWatcher = function (prop, handler) {
		if(typeof(this.propertiesWatched[prop]) == 'undefined') { return; }
		
		for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
			if(this.propertiesWatched[prop].handlers[i].toSource() == handler.toSource()) {
				this.propertiesWatched[prop].handlers.splice(i, 1);
			}
		}
		
		if(this.propertiesWatched[prop].handlers.length == 0) {
			this.propertiesWatched[prop].value = this[prop];
			delete this[prop]; // remove accessors
			this[prop] = this.propertiesWatched[prop].value;
			delete this.propertiesWatched[prop];
		}
	};
	
	// This will hold the current value of all properties being monitored, as well as a list of their handlers to be called
	obj.propertiesWatched = {};
	
	// Attributes part, works by replacing the actual attribute native functions with custom ones (while still using the native ones)
	if(	typeof(obj.callAttributeWatchers) != 'undefined'
		|| typeof(obj.addAttributeWatcher) != 'undefined'
		|| typeof(obj.removeAttributeWatcher) != 'undefined'
		|| typeof(obj.attributesWatched) != 'undefined'
		|| typeof(obj.setAttribute) != 'function'
		|| typeof(obj.setAttributeNS) != 'function'
		|| typeof(obj.setAttributeNode) != 'function'
		|| typeof(obj.setAttributeNodeNS) != 'function'
		|| typeof(obj.removeAttribute) != 'function'
		|| typeof(obj.removeAttributeNS) != 'function'
		|| typeof(obj.removeAttributeNode) != 'function'
		|| typeof(obj.attributes.setNamedItem) != 'function'
		|| typeof(obj.attributes.setNamedItemNS) != 'function'
		|| typeof(obj.attributes.removeNamedItem) != 'function'
		|| typeof(obj.attributes.removeNamedItemNS) != 'function')
	{
		return;
	}
	
	// Monitors 'attr' attribute of element, calling a handler function 'handler' when it is set or removed
	obj.addAttributeWatcher = function (attr, handler) {
		if(typeof(this.attributesWatched[attr]) == 'undefined') {
			this.attributesWatched[attr] = {};
			this.attributesWatched[attr].handlers = new Array();
			this.attributesWatched[attr].handlers.push(handler);
		
			this.attributesWatched[attr].value = this.getAttribute(attr);
		}
		else {
			var add = true;
			for(var i=0; i<this.attributesWatched[attr].handlers.length; i++) {
				if(this.attributesWatched[attr].handlers[i].toSource() == handler.toSource()) {
					add = false;
				}
			}
			if(add) {
				this.attributesWatched[attr].handlers.push(handler);
			}
		}
	};
	
	// Removes handler function 'handler' for attribute 'attr'
	obj.removeAttributeWatcher = function (attr, handler) {
		if(typeof(this.attributesWatched[attr]) == 'undefined') { return; }
		
		for(var i=0; i<this.attributesWatched[attr].handlers.length; i++) {
			if(this.attributesWatched[attr].handlers[i].toSource() == handler.toSource()) {
				this.attributesWatched[attr].handlers.splice(i, 1);
			}
		}
	};
	
	// This will hold the current value of all attributes being monitored, as well as a list of their handlers to be called
	obj.attributesWatched = {};
	
	// Calls handler functions for attribute 'attr'
	obj.callAttributeWatchers = function (el, attr, newval) {
		if(typeof(el.attributesWatched[attr]) == 'undefined') { return; }
		
		for(var i=0; i<el.attributesWatched[attr].handlers.length; i++) {
			try { el.attributesWatched[attr].handlers[i].call(el, attr, el.attributesWatched[attr].value, newval); }
			catch(ex) {
				var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
				consoleService.logStringMessage(ex);
			}
		}
		
		el.attributesWatched[attr].value = newval;
	};
	
	// Store all native functions as '_function' and set custom ones to handle attribute changes
	obj._setAttribute = obj.setAttribute;
	obj._setAttributeNS = obj.setAttributeNS;
	obj._setAttributeNode = obj.setAttributeNode;
	obj._setAttributeNodeNS = obj.setAttributeNodeNS;
	obj._removeAttribute = obj.removeAttribute;
	obj._removeAttributeNS = obj.removeAttributeNS;
	obj._removeAttributeNode = obj.removeAttributeNode;
	obj.attributes._setNamedItem = obj.attributes.setNamedItem;
	obj.attributes._setNamedItemNS = obj.attributes.setNamedItemNS;
	obj.attributes._removeNamedItem = obj.attributes.removeNamedItem;
	obj.attributes._removeNamedItemNS = obj.attributes.removeNamedItemNS;
	
	obj.setAttribute = function(attr, value) {
		this._setAttribute(attr, value);
		this.callAttributeWatchers(this, attr, value);
	};
	obj.setAttributeNS = function(namespace, attr, value) {
		this._setAttributeNS(namespace, attr, value);
		this.callAttributeWatchers(this, attr, value);
	};
	obj.setAttributeNode = function(attr) {
		var ret = this._setAttributeNode(attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.setAttributeNodeNS = function(attr) {
		var ret = this._setAttributeNodeNS(attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.removeAttribute = function(attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		this._removeAttribute(attr);
		if(callWatchers) {
			this.callAttributeWatchers(this, attr, null);
		}
	};
	obj.removeAttributeNS = function(namespace, attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		this._removeAttributeNS(namespace, attr);
		if(callWatchers) {
			this.callAttributeWatchers(this, attr, null);
		}
	};
	obj.removeAttributeNode = function(attr) {
		var callWatchers = (this.hasAttribute(attr.name)) ? true : false;
		var ret = this._removeAttributeNode(attr);
		if(callWatchers) {
			this.callAttributeWatchers(this, attr.name, null);
		}
		return ret;
	};
	obj.attributes.setNamedItem = function(attr) {
		var ret = this.attributes._setNamedItem(attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.attributes.setNamedItemNS = function(namespace, attr) {
		var ret = this.attributes._setNamedItemNS(namespace, attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.attributes.removeNamedItem = function(attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		var ret = this.attributes._removeNamedItem(attr);
		this.callAttributeWatchers(this, attr, null);
		return ret;
	};
	obj.attributes.removeNamedItemNS = function(namespace, attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		var ret = this.attributes._removeNamedItemNS(namespace, attr);
		this.callAttributeWatchers(this, attr, null);
		return ret;
	};
};

// Object to aid in setting and removing all kind of listeners
this.listenerAid = {
	handlers: [],
	
	// if maxTriggers is set to the boolean false, it acts as a switch to not bind the function to our object
	// but if it's set to anything else it will bind the function,
	// thus I can't have an unbound function with maxTriggers
	add: function(obj, type, aListener, capture, maxTriggers) {
		var unboundListener = this.modifyListener(aListener, maxTriggers, true);
		var listener = this.modifyListener(aListener, maxTriggers);
		
		if(obj.addEventListener) {
			if(maxTriggers === true) {
				maxTriggers = 1;
			}
			
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.handlers[i].capture == capture && this.compareListener(this.handlers[i].unboundListener, unboundListener)) {
					return false;
				}
			}
			
			var newHandler = {
				obj: obj,
				type: type,
				unboundListener: unboundListener,
				listener: listener,
				capture: capture,
				maxTriggers: (maxTriggers) ? maxTriggers : null,
				triggerCount: (maxTriggers) ? 0 : null
			};
			this.handlers.push(newHandler);
			var i = this.handlers.length -1;
			
			this.handlers[i].obj.addEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
		}
		else if(obj.events && obj.events.addListener) {
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.compareListener(this.handlers[i].unboundListener, aListener)) {
					return false;
				}
			}
			
			var newHandler = {
				obj: obj,
				type: type,
				unboundListener: unboundListener,
				listener: listener
			};
			this.handlers.push(newHandler);
			var i = this.handlers.length -1;
			this.handlers[i].obj.events.addListener(this.handlers[i].type, this.handlers[i].listener);
		}
		
		return true;
	},
	
	remove: function(obj, type, aListener, capture, maxTriggers) {
		var unboundListener = this.modifyListener(aListener, maxTriggers, true);
			
		if(obj.removeEventListener) {
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.handlers[i].capture == capture && this.compareListener(this.handlers[i].unboundListener, unboundListener)) {
					this.handlers[i].obj.removeEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
					this.handlers.splice(i, 1);
					return true;
				}
			}
		}
		else if(obj.events && obj.events.removeListener) {
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.compareListener(this.handlers[i].unboundListener, unboundListener)) {
					this.handlers[i].obj.events.removeListener(this.handlers[i].type, this.handlers[i].listener);
					this.handlers.splice(i, 1);
					return true;
				}
			}
		}
		
		return false;
	},
	
	clean: function() {
		var i = 0;
		while(i < this.handlers.length) {
			if(this.handlers[i].obj) {
				if(this.handlers[i].obj == window && this.handlers[i].type == 'unload' && !this.handlers[i].capture) {
					i++;
					continue;
				}
				
				if(this.handlers[i].obj.removeEventListener) {
					this.handlers[i].obj.removeEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
				}
				else if(this.handlers[i].obj.events && this.handlers[i].obj.events.removeListener) {
					this.handlers[i].obj.events.removeListener(this.handlers[i].type, this.handlers[i].listener);
				}
			}
			this.handlers.splice(i, 1);
		}
		return true;
	},
	
	compareListener: function(a, b) {
		if(a == b || a.toSource() == b.toSource()) {
			return true;
		}
		return false;
	},
	
	modifyListener: function(listener, maxTriggers, forceUnbound) {
		var newListener = listener;
		
		if(maxTriggers) {
			newListener = modifyFunction(listener, [
				['{',
				<![CDATA[
				{
					var targets = ['target', 'originalTarget', 'currentTarget'];
					
					mainRemoveListenerLoop:
					for(var a = 0; a < targets.length; a++) {
						for(var i = 0; i < this.listenerAid.handlers.length; i++) {
							if(this.listenerAid.handlers[i].obj == arguments[0][targets[a]]
							&& this.listenerAid.handlers[i].type == arguments[0].type
								&& ((this.listenerAid.handlers[i].capture && arguments[0].eventPhase == arguments[0].CAPTURING_PHASE)
								|| (!this.listenerAid.handlers[i].capture && arguments[0].eventPhase != arguments[0].CAPTURING_PHASE))
							&& this.listenerAid.compareListener(this.listenerAid.handlers[i].unboundListener, arguments.callee)) {
								this.listenerAid.handlers[i].triggerCount++;
								if(this.listenerAid.handlers[i].triggerCount == this.listenerAid.handlers[i].maxTriggers) {
									this.listenerAid.remove(arguments[0][targets[a]], this.listenerAid.handlers[i].type, this.listenerAid.handlers[i].unboundListener, this.listenerAid.handlers[i].capture);
									break mainRemoveListenerLoop;
								}
							}
						}
					}
				]]>
				],
				
				// This is just so my editor correctly assumes the pairs of {}, it has nothing to do with the add-on itself
				['}',
				<![CDATA[
				}
				]]>
				]
			]);
		}
		
		if(maxTriggers !== false && !forceUnbound) {
			newListener = newListener.bind(self);
		}
		return newListener;
	}
};
// remove every listener placed when closing the window
listenerAid.add(window, "unload", function() { listenerAid.clean(); }, false, true);

// this lets me run functions asyncronously, basically it's a one shot timer with a delay of 0msec
this.aSync = function(aFunc) {
	return timerAid.create(aFunc, 0);
}

// Object to aid in setting, initializing and cancelling timers
this.timerAid = {
	_timers: {},
	
	init: function(aName, aFunc, aDelay, aType) {
		this.cancel(aName);
		
		var type = this._switchType(aType);
		this._timers[aName] = {
			timer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
			handler: aFunc
		};
		this._timers[aName].timer.init(function(aSubject, aTopic, aData) {
			timerAid._timers[aName].handler.call(self, aSubject, aTopic, aData);
			if(typeof(timerAid) != 'undefined' && aSubject.type == Components.interfaces.nsITimer.TYPE_ONE_SHOT) {
				timerAid.cancel(aName);
			}
		}, aDelay, type);
		
		this.__defineGetter__(aName, function() { return this._timers[aName]; });
		return this._timers[aName];
	},
	
	cancel: function(name) {
		if(this._timers[name]) {
			this._timers[name].timer.cancel();
			delete this._timers[name];
			delete this[name];
			return true;
		}
		return false;
	},
	
	cancelAll: function() {
		for(var timerObj in this._timers) {
			this.cancel(timerObj);
		}
	},
	
	create: function(aFunc, aDelay, aType) {
		var type = this._switchType(aType);
		var newTimer = {
			timer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
			handler: aFunc.bind(self),
			cancel: function() {
				this.timer.cancel();
			}
		};
		newTimer.timer.init(newTimer.handler, aDelay, type);
		return newTimer;
	},
			
	_switchType: function(type) {
		switch(type) {
			case 'slack':
				return Components.interfaces.nsITimer.TYPE_REPEATING_SLACK;
				break;
			case 'precise':
				return Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE;
				break;
			case 'precise_skip':
				return Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP;
				break;
			case 'once':
			default:
				return Components.interfaces.nsITimer.TYPE_ONE_SHOT;
				break;
		}
		
		return false;
	}
};
listenerAid.add(window, 'unload', function() { timerAid.cancelAll(); }, false, true);

this.prefAid = {
	_prefObjects: {},
	length: 0,
	
	init: function(prefList, branch) {
		if(!branch) {
			branch = objPathString;
		}
		if(typeof(prefList) == 'string') {
			this._setPref(prefList, branch);
		} else {
			for(var i=0; i<prefList.length; i++) {
				this._setPref(prefList[i], branch);
			}
		}
	},
	
	_setPref: function(pref, branch) {
		if(!this._prefObjects[pref]) {
			this._prefObjects[pref] = Application.prefs.get('extensions.'+branch+'.' + pref);
			this.__defineGetter__(pref, function() { return this._prefObjects[pref].value; });
			this.__defineSetter__(pref, function(v) { return this._prefObjects[pref].value = v; });
			this.length++;
		}
	},
	
	listen: function(pref, handler) {
		listenerAid.add(this._prefObjects[pref], "change", handler);
	},
	
	unlisten: function(pref, handler) {
		listenerAid.remove(this._prefObjects[pref], "change", handler);
	},
	
	reset: function(pref) {
		this._prefObjects[pref].reset();
	}
};

// Create the observer object from a function if that is what is provided and registers it
this.observerAid = {
	// Since I'm immediatelly adding a 'quit-application' observer, I need the service right away, so no need in delaying it
	obsService: Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService),
	observers: [],
	hasQuit: false,
	
	createObject: function(anObserver) {
		var retObj = (typeof(anObserver) == 'function') ? { observe: anObserver } : anObserver;
		return retObj;
	},
	
	add: function(anObserver, aTopic, ownsWeak) {
		var observer = this.createObject(anObserver);
		
		for(var i = 0; i < this.observers.length; i++) {
			if(this.observers[i].observer == observer && this.observers[i].topic == aTopic) {
				return false;
			}
		}
		
		var newObs = {
			topic: aTopic,
			observer: observer
		};
		var i = this.observers.length;
		this.observers.push(newObs);
		this.obsService.addObserver(this.observers[i].observer, aTopic, ownsWeak);
		return true;
	},
	
	remove: function(anObserver, aTopic) {
		var observer = this.createObject(anObserver);
		
		for(var i = 0; i < this.observers.length; i++) {
			if(this.observers[i].observer == observer && this.observers[i].topic == aTopic) {
				this.obsService.removeObserver(this.observers[i].observer, this.observers[i].topic);
				this.observers.splice(i, 1);
				return true;
			}
		}
		return false;
	},
	
	clean: function() {
		// Sometimes the "unload" event comes before the "quit-application" observing, with "quit-application" most times not happening at all,
		// this forces the observers for that to trigger before I remove them
		if(!this.hasQuit) {
			this.obsService.notifyObservers(null, 'quit-application', null);
		}
		
		while(this.observers.length) {
			this.obsService.removeObserver(this.observers[0].observer, this.observers[0].topic);
			this.observers.shift();
		}
	}
};
observerAid.add(function() { observerAid.hasQuit = true; }, 'quit-application');
listenerAid.add(window, "unload", function() { observerAid.clean(); }, false, true);

// Private browsing mode listener as on https://developer.mozilla.org/En/Supporting_private_browsing_mode, with a few modifications
// Prepares an object to be used as a pb listener, expects methods autoStarted, onEnter, onExit, onQuit and applies them accordingly
this.privateBrowsingAid = {
	pbService: null,
	get autoStarted () { this.init(); return this.pbService.autoStarted; },
	get inPrivateBrowsing () { this.init(); return this.pbService.privateBrowsingEnabled; },
	
	init: function() {
		this.pbService = Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService);
		this.init = function() { return false; };
		return true;
	},
	
	prepare: function(aWatcher) {
		var watcherObj = aWatcher;
		if(!watcherObj.observe) {
			watcherObj.observe = function(aSubject, aTopic, aData) {
				if(aTopic == "private-browsing") {
					if(aData == "enter" && this.onEnter) {
						this.onEnter();
					} else if(aData == "exit" && this.onExit) {
						this.onExit();
					}
				} else if(aTopic == "quit-application" && this.onQuit) {
					this.onQuit();
				}
			};
		}
		if(!watcherObj.autoStarted) { watcherObj.autoStarted = null; }
		if(!watcherObj.onEnter) { watcherObj.onEnter = null; }
		if(!watcherObj.onExit) { watcherObj.onExit = null; }
		if(!watcherObj.onQuit) { watcherObj.onQuit = null; }
		return watcherObj;
	},
	
	addWatcher: function(aWatcher) {
		var watcher = this.prepare(aWatcher);
		
		observerAid.add(watcher, "private-browsing");
		observerAid.add(watcher, "quit-application");
		
		if(this.inPrivateBrowsing && watcher.autoStarted) {
			watcher.autoStarted();
		}
	},
	
	removeWatcher: function(aWatcher) {
		var watcher = this.prepare(aWatcher);
		
		observerAid.remove(watcher, "private-browsing");
		observerAid.remove(watcher, "quit-application");
	}
};

// This allows me to handle loading and unloading of stylesheets in a quick and easy way
this.styleAid = {
	sss: null,
	ios: null,
	_loadedSheets: [],
	
	init: function() {
		this.sss = Components.classes["@mozilla.org/content/style-sheet-service;1"].getService(Components.interfaces.nsIStyleSheetService);
		this.ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		this.init = function() { return false; };
		return true;
	},
	
	load: function(aName, aPath) {
		this.init();
		var path = this.convert(aPath);
		
		this.unload(aName, path);
		this._loadedSheets.push({
			name: aName,
			path: path,
			uri: this.ios.newURI(path, null, null)
		});
		var i = this._loadedSheets.length -1;
		if(!this.sss.sheetRegistered(this._loadedSheets[i].uri, this.sss.AGENT_SHEET)) {
			this.sss.loadAndRegisterSheet(this._loadedSheets[i].uri, this.sss.AGENT_SHEET);
		}
		return true;
	},
	
	unload: function(aName, aPath) {
		this.init();
		
		if(typeof(aName) != 'string') {
			for(var a = 0; a < aName.length; a++) {
				this.unload(aName[a]);
			}
			return true;
		};
		
		var path = this.convert(aPath);
		for(var i = 0; i < this._loadedSheets.length; i++) {
			if(this._loadedSheets[i].name == aName || (path && path == this._loadedSheets[i].path)) {
				if(this.sss.sheetRegistered(this._loadedSheets[i].uri, this.sss.AGENT_SHEET)) {
					this.sss.unregisterSheet(this._loadedSheets[i].uri, this.sss.AGENT_SHEET);
				}
				this._loadedSheets.splice(i, 1);
				return true;
			}
		}
		return false;
	},
	
	convert: function(aPath) {
		if(aPath && aPath.indexOf("chrome://") != 0 && aPath.indexOf("data:text/css") != 0) {
			return 'data:text/css,' + encodeURIComponent(aPath);
		}
		return aPath;
	}
};
