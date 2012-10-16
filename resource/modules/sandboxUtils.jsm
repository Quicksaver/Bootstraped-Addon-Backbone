moduleAid.VERSION = '1.2.5';
moduleAid.VARSLIST = ['Globals', 'prefAid', 'styleAid', 'windowMediator', 'window', 'document', 'observerAid', 'privateBrowsingAid', 'overlayAid', 'stringsAid', 'xmlHttpRequest', 'aSync', 'objectWatcher', 'dispatch', 'compareFunction', 'isAncestor', 'hideIt', 'trim', 'closeCustomize', 'setAttribute', 'removeAttribute', 'toggleAttribute'];

// Globals - lets me use objects that I can share through all the windows
this.Globals = {};

// prefAid - Object to contain and manage all preferences related to the add-on (and others if necessary)
// setDefaults(prefList, branch) - sets the add-on's preferences default values
//	prefList - (object) { prefName: defaultValue }
//	(optional) branch - (string) looks for 'extensions.branch.prefName', defaults to objPathString
// listen(pref, handler) - add handler as a change event listener to pref
//	pref - (string) name of preference to append handler to
//	handler - (function) to be fired on change event
// unlisten(pref, handler) - remove handler as a change event listener of pref
//	see listen()
// listening(pref, handler) - returns (int) with corresponding listener index in _onChange[] if handler is registered as pref listener, returns (bool) false otherwise
//	see listen()
// reset(pref) - resets pref to default value
//	see listen()
this.prefAid = {
	_prefObjects: {},
	_onChange: {},
	length: 0,
	
	setDefaults: function(prefList, branch) {
		if(!branch) {
			branch = objPathString;
		}
		
		var readyList = [];
		
		var defaultBranch = Services.prefs.getDefaultBranch('extensions.'+branch+'.');
		for(var pref in prefList) {
			if(typeof(prefList[pref]) == 'string') {
				defaultBranch.setCharPref(pref, prefList[pref]);
			} else if(typeof(prefList[pref]) == 'boolean') {
				defaultBranch.setBoolPref(pref, prefList[pref]);
			} else if(typeof(prefList[pref]) == 'number') {
				defaultBranch.setIntPref(pref, prefList[pref]);
			}
			
			readyList.push(pref);
		}
		
		this.ready(readyList, branch);
	},
	
	ready: function(prefList, branch) {
		if(!branch) {
			branch = objPathString;
		}
		
		if(typeof(prefList) == 'string') {
			prefList = [prefList];
		}
		
		for(var i=0; i<prefList.length; i++) {
			if(!this._prefObjects[prefList[i]]) {
				this._setPref(prefList[i], branch);
			}
		}
	},
	
	_setPref: function(pref, branch) {
		this._prefObjects[pref] = Services.fuel.prefs.get('extensions.'+branch+'.'+pref);
		this._onChange[pref] = [];
		this.__defineGetter__(pref, function() { return this._prefObjects[pref].value; });
		this.__defineSetter__(pref, function(v) { return this._prefObjects[pref].value = v; });
		this.length++;
		
		this._prefObjects[pref].events.addListener("change", this.prefChanged);
	},
	
	listen: function(pref, handler) {
		if(this.listening(pref, handler) === false) {
			this._onChange[pref].push(handler);
			return true;
		}
		return false;
	},
	
	unlisten: function(pref, handler) {
		var i = this.listening(pref, handler)
		if(i !== false) {
			this._onChange[pref].splice(i, 1);
			return true;
		}
		return false;
	},
	
	listening: function(pref, handler) {
		for(var i = 0; i < this._onChange[pref].length; i++) {
			if(compareFunction(this._onChange[pref][i], handler, true)) {
				return i;
			}
		}
		return false;
	},
	
	reset: function(pref) {
		this._prefObjects[pref].reset();
	},
	
	prefChanged: function(e) {
		var pref = e.data.substr(e.data.indexOf('.', e.data.indexOf('.')+1) +1);
		for(var i = 0; i < prefAid._onChange[pref].length; i++) {
			prefAid._onChange[pref][i]();
		}
	},
	
	clean: function() {
		for(var pref in this._prefObjects) {
			this._prefObjects[pref].events.removeListener("change", this.prefChanged);
		}
	}
};

// styleAid - handle loading and unloading of stylesheets in a quick and easy way
// load(aName, aPath, isData) - loads aPath css stylesheet with type AGENT_SHEET
//	aName - (string) to name the stylesheet object in sheets[]
//	aPath -
//		(string) absolute chrome:// path to the stylesheet to be loaded
//		(string) name of the .css file to be loaded from chrome://objPathString/skin/aPath.css
//		(string) css declarations
//	(optional) isData - 
//		true treats aPath as css declarations and appends "data:text/css," if necessary
//		defaults to false
// unload(aName, aPath, isData) - unloads aPath css stylesheet
//	(optional) aPath
//	see load()
// loaded(aName, aPath) - returns (int) with corresponding sheet index in sheets[] if aName or aPath has been loaded, returns (bool) false otherwise
//	see unload()
this.styleAid = {
	sheets: [],
	
	load: function(aName, aPath, isData) {
		var path = this.convert(aPath, isData);
		
		var alreadyLoaded = this.loaded(aName, path);
		if(alreadyLoaded !== false) {
			if(this.sheets[alreadyLoaded].name == aName) {
				if(this.sheets[alreadyLoaded].path == path) {
					return false;
				}
				this.unload(aName);
			}
		}
		
		var i = this.sheets.push({
			name: aName,
			path: path,
			uri: Services.io.newURI(path, null, null)
		}) -1;
		if(!Services.stylesheet.sheetRegistered(this.sheets[i].uri, Services.stylesheet.AGENT_SHEET)) {
			Services.stylesheet.loadAndRegisterSheet(this.sheets[i].uri, Services.stylesheet.AGENT_SHEET);
		}
		return true;
	},
	
	unload: function(aName, aPath, isData) {
		if(typeof(aName) != 'string') {
			for(var a = 0; a < aName.length; a++) {
				this.unload(aName[a]);
			}
			return true;
		};
		
		var path = this.convert(aPath, isData);
		var i = this.loaded(aName, path);
		if(i !== false) {
			var uri = this.sheets[i].uri;
			this.sheets.splice(i, 1);
			for(var s = 0; s < this.sheets.length; s++) {
				if(this.sheets[s].path == path) {
					return true;
				}
			}
			if(Services.stylesheet.sheetRegistered(uri, Services.stylesheet.AGENT_SHEET)) {
				Services.stylesheet.unregisterSheet(uri, Services.stylesheet.AGENT_SHEET);
			}
			return true;
		}
		return false;
	},
	
	loaded: function(aName, aPath) {
		for(var i = 0; i < this.sheets.length; i++) {
			if(this.sheets[i].name == aName || (aPath && this.sheets[i].path == aPath)) {
				return i;
			}
		}
		return false;
	},
	
	convert: function(aPath, isData) {
		if(!aPath) {
			return aPath;
		}
		
		if(!isData && aPath.indexOf("chrome://") != 0) {
			return "chrome://"+objPathString+"/skin/"+aPath+".css";
		}
		
		if(isData && aPath.indexOf("data:text/css,") != 0) {
			return 'data:text/css,' + encodeURIComponent(aPath);
		}
		
		return aPath;
	}
};

// windowMediator - Aid object to help with window tasks involving window-mediator and window-watcher
// getEnumerator(aType) - returns an nsISimpleEnumerator object with all windows of aType
//	(optional) aType - (string) window type to get, defaults to null (all)
// callOnMostRecent(aCallback, aType) - calls aCallback passing it the most recent window of aType as an argument
//	aCallback - (function(window)) to be called on window
//	(optional) aType - type of windows to execute aCallback on, defaults to null (all)
// callOnAll(aCallback, aType, aURI, beforeComplete) - goes through every opened browser window of aType and executes aCallback on it
//	(optional) aURI - (string) when defined, checks the documentURI property against the aURI value and only executes aCallback when true, defaults to null
//	(optional) beforeComplete - (bool) true calls aCallback immediatelly regardless of readyState, false fires aCallback when window loads if readyState != complete, defaults to false
//	see callOnMostRecent()
// callOnLoad(aWindow, aCallback, aType, aURI) - calls aCallback when load event is fired on that window
//	aWindow - (xul object) window object to execute aCallback on
//	see callOnMostRecent() and callOnAll
// register(aHandler, aTopic) - registers aHandler to be notified of every aTopic
//	aHandler - (function) handler to be fired
//	aTopic - (string) "domwindowopened" or (string) "domwindowclosed"
// unregister(aHandler, aTopic) - unregisters aHandler from being notified of every aTopic
//	see register()
// watching(aHandler, aTopic) - returns (int) with corresponding watcher index in watchers[] if aHandler has been registered for aTopic, returns (bool) false otherwise
//	see register()
this.windowMediator = {
	watchers: [],
	
	getEnumerator: function(aType) {
		var type = aType || null;
		return Services.wm.getEnumerator(type);
	},
	
	callOnMostRecent: function(aCallback, aType) {
		var type = aType || null;
		var window = Services.wm.getMostRecentWindow(aType);
		if(window) {
			aCallback(window);
		}
	},
	
	// expects aCallback() and sets its this as the window
	callOnAll: function(aCallback, aType, aURI, beforeComplete) {
		var browserEnumerator = this.getEnumerator(aType);
		while(browserEnumerator.hasMoreElements()) {
			var window = browserEnumerator.getNext();
			if(!aURI || window.document.documentURI == aURI) {
				if(window.document.readyState == "complete" || beforeComplete) {
					aCallback(window);
				} else {
					this.callOnLoad(window, aCallback);
				}
			}
		}
	},
	
	callOnLoad: function(aWindow, aCallback, aType, aURI) {
		listenOnce(aWindow, "load", function(event, aWindow) {
			if(UNLOADED) { return; }
			
			if((!aType || aWindow.document.documentElement.getAttribute('windowtype') == aType)
			&& (!aURI || aWindow.document.documentURI == aURI)) {
				aCallback(aWindow);
			}
		});
	},
	
	register: function(aHandler, aTopic) {
		if(this.watching(aHandler, aTopic) === false) {
			this.watchers.push({ handler: aHandler, topic: aTopic });
		}
	},
	
	unregister: function(aHandler, aTopic) {
		var i = this.watching(aHandler, aTopic);
		if(i !== false) {
			this.watchers.splice(i, 1);
		}
	},
	
	callWatchers: function(aSubject, aTopic) {
		for(var i = 0; i < windowMediator.watchers.length; i++) {
			if(windowMediator.watchers[i].topic == aTopic) {
				windowMediator.watchers[i].handler.call(self, aSubject, aTopic);
			}
		}
	},
	
	watching: function(aHandler, aTopic) {
		for(var i = 0; i < this.watchers.length; i++) {
			if(this.watchers[i].handler == aHandler && this.watchers[i].topic == aTopic) {
				return i;
			}
		}
		return false;
	}
};

// window - Similarly to windowMediator.callOnMostRecent, the window property returns the most recent navigator:browser window object
// document - Returns the document object associated with the most recent window object
this.__defineGetter__('window', function() { return Services.wm.getMostRecentWindow('navigator:browser'); });
this.__defineGetter__('document', function() { return window.document; });

// observerAid - Helper for adding and removing observers
// add(anObserver, aTopic, ownsWeak) - Create the observer object from a function if that is what is provided and registers it
//	anObserver - (nsIObserver) to be registered, (function) creates a (nsIObserver){ observe: anObserver } and registers it
//	aTopic - (string) notification to be observed by anObserver
//	(optional) ownsWeak - defaults to false, recommended in MDN, have never seen any case where it is true anyway
// remove(anObserver, aTopic) - unregisters anObserver from watching aTopic
//	see add()
// observing(anObserver, aTopic) - returns (int) with corresponding observer index in observers[] if anObserver has been registered for aTopic, returns (bool) false otherwise
//	see add()
// notify(aTopic, aSubject, aData) - notifies observers of a particular topic
//	aTopic - (string) The notification topic
//	(optional) aSubject - (object) usually where the notification originated from, can be (bool) null; if undefined, it is set to self
//	(optional) aData - (object) varies with the notification topic as needed
this.observerAid = {
	observers: [],
	hasQuit: false,
	
	createObject: function(anObserver) {
		var retObj = (typeof(anObserver) == 'function') ? { observe: anObserver } : anObserver;
		return retObj;
	},
	
	add: function(anObserver, aTopic, ownsWeak) {
		var observer = this.createObject(anObserver);
		
		if(this.observing(observer, aTopic) !== false) {
			return false;
		}
		
		var i = this.observers.push({ topic: aTopic, observer: observer }) -1;
		Services.obs.addObserver(this.observers[i].observer, aTopic, ownsWeak);
		return true;
	},
	
	remove: function(anObserver, aTopic) {
		var observer = this.createObject(anObserver);
		
		var i = this.observing(observer, aTopic);
		if(i !== false) {
			Services.obs.removeObserver(this.observers[i].observer, this.observers[i].topic);
			this.observers.splice(i, 1);
			return true;
		}
		return false;
	},
	
	observing: function(anObserver, aTopic) {
		for(var i = 0; i < this.observers.length; i++) {
			if(this.observers[i].observer == anObserver && this.observers[i].topic == aTopic) {
				return i;
			}
		}
		return false;
	},
	
	// this forces the observers for quit-application to trigger before I remove them
	callQuits: function() {
		if(this.hasQuit) { return false; }
		for(var i = 0; i < this.observers.length; i++) {
			if(this.observers[i].topic == 'quit-application') {
				this.observers[i].observer.observe(null, 'quit-application', null);
			}
		}
		return true;
	},
	
	clean: function() {
		while(this.observers.length) {
			Services.obs.removeObserver(this.observers[0].observer, this.observers[0].topic);
			this.observers.shift();
		}
	},
	
	notify: function(aTopic, aSubject, aData) {
		if(aSubject == undefined) {
			aSubject = self;
		}
		Services.obs.notifyObservers(aSubject, aTopic, aData);
	}
};

// privateBrowsingAid - Private browsing mode listener as on https://developer.mozilla.org/En/Supporting_private_browsing_mode, with a few modifications
// get autoStarted - returns (bool) pb autoStarted
// get inPrivateBrowing - returns (bool) privateBrowsingEnabled
// addWatcher(aWatcher) - prepares aWatcher to be used as a pb listener and registers it
//	aWatcher - (object) to register as a pb observer,
//		expects methods autoStarted, onEnter, onExit, onQuit and applies them accordingly,
//		if it doesn't have an observe method it is created
// removeWatcher(aWatcher) - removes aWatcher from listening to pb notifications
//	see addWatcher()
this.privateBrowsingAid = {
	get autoStarted () { return Services.privateBrowsing.autoStarted; },
	get inPrivateBrowsing () { return Services.privateBrowsing.privateBrowsingEnabled; },
	
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

// overlayAid - to use overlays in my bootstraped add-ons. The behavior is as similar to what is described in https://developer.mozilla.org/en/XUL_Tutorial/Overlays as I could manage.
// When a window with an overlay is opened, the elements in both the window and the overlay with the same ids are combined together.
// The children of matching elements are added to the end of the set of children in the window's element.
// Attributes that are present on the overlay's elements will be applied to the window's elements.
// Overlays can also have their own:
//	stylesheets by placing at the top of the overlay: <?xml-stylesheet href="chrome://addon/skin/sheet.css" type="text/css"?>
//	DTD's by the usual method: <!DOCTYPE window [ <!ENTITY % nameDTD SYSTEM "chrome://addon/locale/file.dtd"> %nameDTD; ]>
//	scripts using the script tag when as a direct child of the overlay element (effects of these won't be undone when unloading the overlay, I have to 
//		undo it in the onunload function passed to overlayURI() ). Any script that changes the DOM structure might produce unpredictable results!
// The overlay element surrounds the overlay content. It uses the same namespace as XUL window files. The id of these items should exist in the window's content.
// Its content will be added to the window where a similar element exists with the same id value. If such an element does not exist, that part of the overlay is ignored.
// If there is content inside both the XUL window and in the overlay, the window's content will be used as is and the overlay's content will be appended to the end.
// The children of the overlay's element are inserted as children of the base window's element.
//	If the overlay's element contains an insertafter attribute, the element is added just after the element in the base window with the id that matches the value of this attribute.
//	If the overlay's element contains an insertbefore attribute, the element is added just before the element in the base window with the id that matches the value of this attribute.
//	If the overlay's element contains an position attribute, the element is added at the one-based index specified in this attribute.
//	Otherwise, the element is added as the last child.
// If you would like to remove an element that is already in the XUL file, create elements with removeelement attribute.
// For overlaying preferences dialogs, you can add new preferences in an unnamed <preferences> element. They will be added to an already existing <preferences> element if present,
// or the whole element will be overlayed if not.
// Elements with a getchildrenof attribute will inherit all the children from the elements specified by the comma-separated list of element ids.
// Every occurence of (string) objName and (string) objPathString in every attribute in the overlay will be properly replaced with this object's objName and objPathString.
// I can also overlay other overlays provided they are loaded through the overlayAid object (either from this add-on or another implementing it).
// overlayURI(aURI, aWith, beforeload, onload, onunload) - overlays aWith in all windows with aURI
//	aURI - (string) uri to be overlayed
//	aWith - (string) uri to overlay aURI, can be fileName found as chrome://objPathString/content/fileName.xul or already the full uri path
//	(optional) beforeload ( function(window) ) is called before the window is overlayed, expects a (object) window argument
//	(optional) onload - ( function(window) ) to be called when aURI is overlayed with aWith, expects a (object) window argument
//	(optional) onunload - ( function(window) ) to be called when aWith is unloaded from aURI, expects a (object) window argument
// removeOverlayURI(aURI, aWith) - removes aWith overlay from all windows with aURI
//	see overlayURI()
// overlayWindow(aWindow, aWith, beforeload, onload, onunload) - overlays aWindow with aWith
//	aWindow - (object) window object to be overlayed
//	see overlayURI()
// removeOverlayWindow(aWindow, aWith) - removes aWith overlay from aWindow
//	see overlayWindow()
// loadedURI(aURI, aWith) - returns (int) with corresponding overlay index in overlays[] if overlay aWith has been loaded for aURI, returns (bool) false otherwise 
//	see overlayURI()
// loadedWindow(aWindow, aWith) -	returns (int) with corresponding overlay index in aWindow._OVERLAYS_LOADED[] if overlay aWith has been loaded for aWindow,
//					returns (bool) false otherwise 
//	see overlayWindow()
this.overlayAid = {
	overlays: [],
	
	overlayURI: function(aURI, aWith, beforeload, onload, onunload) {
		var path = this.getPath(aWith);
		if(this.loadedURI(aURI, path) !== false) { return; }
		
		var newOverlay = {
			uri: aURI,
			overlay: path,
			beforeload: beforeload || null,
			onload: onload || null,
			onunload: onunload || null,
			document: null,
			persist: { length: 0 }
			
		};
		var i = this.overlays.push(newOverlay) -1;
		
		xmlHttpRequest(path, function(xmlhttp) {
			if(xmlhttp.readyState === 4) {
				overlayAid.overlays[i].document = xmlhttp.responseXML;
				overlayAid.cleanXUL(overlayAid.overlays[i].document, this.overlays[i]);
				windowMediator.callOnAll(overlayAid.scheduleAll);
			}
		});
	},
	
	removeOverlayURI: function(aURI, aWith) {
		// I sometimes call removeOverlayURI() when unloading modules, but these functions are also called when shutting down the add-on, preventing me from unloading the overlays.
		// This makes it so it keeps the reference to the overlay when shutting down so it's properly removed in unloadAll().
		if(UNLOADED) { return; }
		
		var path = this.getPath(aWith);
		var i = this.loadedURI(aURI, path);
		if(i === false) { return; }
		
		this.overlays.splice(i, 1);
		
		windowMediator.callOnAll(function(aWindow) {
			overlayAid.scheduleUnOverlay(aWindow, path);
		});
	},
	
	overlayWindow: function(aWindow, aWith, beforeload, onload, onunload) {
		var path = this.getPath(aWith);
		if(this.loadedWindow(aWindow, path) !== false) { return; }
		
		var newOverlay = {
			uri: path,
			traceBack: [],
			beforeload: beforeload || null,
			onload: onload || null,
			onunload: onunload || null,
			document: null,
			loaded: false,
			remove: false,
			persist: { length: 0 }
		};
		
		if(aWindow._OVERLAYS_LOADED == undefined) {
			aWindow._OVERLAYS_LOADED = [];
		}
		var i = aWindow._OVERLAYS_LOADED.push(newOverlay) -1;
		
		xmlHttpRequest(path, function(xmlhttp) {
			if(xmlhttp.readyState === 4) {
				aWindow._OVERLAYS_LOADED[i].document = xmlhttp.responseXML;
				overlayAid.cleanXUL(aWindow._OVERLAYS_LOADED[i].document, aWindow._OVERLAYS_LOADED[i]);
				overlayAid.scheduleAll(aWindow);
			}
		});
	},
	
	removeOverlayWindow: function(aWindow, aWith) {
		var path = this.getPath(aWith);
		var i = this.loadedWindow(aWindow, path);
		if(i === false) { return; }
		
		aWindow._OVERLAYS_LOADED[i].remove = true;
		
		// I sometimes call removeOverlayWindow() when unloading modules, but these functions are also called when shutting down the add-on, preventing me from unloading the 
		// overlays. This makes it so it keeps the reference to the overlay when shutting down so it's properly removed in unloadAll().
		if(UNLOADED) { return; }
		
		overlayAid.scheduleUnOverlay(aWindow, path);
	},
	
	loadedURI: function(aURI, aWith) {
		var path = this.getPath(aWith);
		for(var i = 0; i < this.overlays.length; i++) {
			if(this.overlays[i].uri == aURI && this.overlays[i].overlay == path) {
				return i;
			}
		}
		return false;
	},
	
	loadedWindow: function(aWindow, uri) {
		if(aWindow._OVERLAYS_LOADED == undefined) {
			return false;
		}
		for(var i = 0; i < aWindow._OVERLAYS_LOADED.length; i++) {
			if(aWindow._OVERLAYS_LOADED[i].uri == uri) {
				return i;
			}
		}
		return false;
	},
	
	getPath: function(aPath) {
		return (aPath.indexOf("chrome://") === 0) ? aPath : "chrome://"+objPathString+"/content/"+aPath+".xul";
	},
	
	cleanXUL: function(node, overlay) {
		// Replace objName with this objName in every attribute
		if(node.attributes) {
			for(var a = 0; a < node.attributes.length; a++) {
				while(node.attributes[a].value.indexOf('objName') > -1) {
					node.attributes[a].value = node.attributes[a].value.replace('objName', objName);
				}
				while(node.attributes[a].value.indexOf('objPathString') > -1) {
					node.attributes[a].value = node.attributes[a].value.replace('objPathString', objPathString);
				}
				
				if(node.attributes[a].name == 'persist' && node.id && node.id != 'length' /* <- failsafe */) {
					var persists = node.attributes[a].value.split(' ');
					overlay.persist[node.id] = {};
					for(var p=0; p<persists.length; p++) {
						overlay.persist[node.id][persists[p]] = true;
					}
					overlay.persist.length++;
				}
			}
		}
		
		if(node.nodeName == 'xml-stylesheet') {
			while(node.textContent.indexOf('objName') > -1) {
				node.textContent = node.textContent.replace('objName', objName);
			}
			while(node.textContent.indexOf('objPathString') > -1) {
				node.textContent = node.textContent.replace('objPathString', objPathString);
			}
		}
		
		var curChild = node.firstChild;
		while(curChild) {
			if((curChild.nodeName == '#text' && !curChild.id && trim(curChild.nodeValue) === '') // remove useless #text elements
			|| (curChild.nodeName == 'script' && node.nodeName != 'overlay') // remove script tags that won't be inserted into the overlayed document
			) {
				var nextChild = curChild.nextSibling;
				node.removeChild(curChild);
				curChild = nextChild;
				continue;
			}
			
			this.cleanXUL(curChild, overlay);
			curChild = curChild.nextSibling;
		}
	},
	
	isPersist: function(overlay, id, attr) {
		if(!id && !attr) {
			return overlay.persist.length > 0;
		}
		
		if(overlay.persist[id]) {
			if(attr && !overlay.persist[id][attr]) {
				return false;
			}
			return true;
		}
		return false;
	},
	
	persistOverlay: function(aWindow, overlay) {
		if(!this.isPersist(overlay)) {
			return;
		}
		
		var allRes = {};
		function showArcs(res, arcs) {
			while(arcs.hasMoreElements()) {
				var curArc = arcs.getNext().QueryInterface(Ci.nsIRDFResource);
				var arcTargets = PlacesUIUtils.localStore.GetTargets(res, curArc, true);
				while(arcTargets.hasMoreElements()) {
					var curTarget = arcTargets.getNext();
					try {
						curTarget.QueryInterface(Ci.nsIRDFLiteral);
						
						var sources = res.Value.split('#');
						if(!allRes[sources[0]]) { allRes[sources[0]] = {}; }
						if(sources[1]) {
							if(!allRes[sources[0]][sources[1]]) { allRes[sources[0]][sources[1]] = {}; }
							allRes[sources[0]][sources[1]][curArc.Value] = curTarget.Value;
						} else {
							allRes[sources[0]][curArc.Value] = curTarget.Value;
						}
					}
					catch(e) {
						if(curTarget.Value) {
							showArcs(curTarget, PlacesUIUtils.localStore.ArcLabelsOut(curTarget));
						}
					}
				}
			}
		}
		
		var allResources = PlacesUIUtils.localStore.GetAllResources();
		while(allResources.hasMoreElements()) {
			var curResource = allResources.getNext().QueryInterface(Ci.nsIRDFResource);
			showArcs(curResource, PlacesUIUtils.localStore.ArcLabelsOut(curResource));
		}
		
		var uri = aWindow.document.baseURI;
		if(!allRes[uri]) { return; }
		for(var id in allRes[uri]) {
			var node = document.getElementById(id);
			if(!node) { continue; }
			
			if(this.isPersist(overlay, id)) {
				for(var attr in allRes[uri][id]) {
					if(this.isPersist(overlay, id, attr)) {
						toggleAttribute(node, attr, allRes[uri][id][attr], allRes[uri][id][attr]);
						
						if(attr == 'currentset'
						&& node.nodeName == 'toolbar'
						&& node.getAttribute('toolboxid')
						&& aWindow.document.getElementById(node.getAttribute('toolboxid'))) {
							var palette = aWindow.document.getElementById(node.getAttribute('toolboxid')).palette;
							if(!palette) { continue; }
							
							var currentset = node.getAttribute('currentset').split(',');
							for(var c=0; c<currentset.length; c++) {
								for(var p=0; p<palette.childNodes.length; p++) {
									if(palette.childNodes[p].id == currentset[c]) {
										this.insertItem(aWindow, node, palette.childNodes[p]);
										break;
									}
								}
							}
						}
					}
				}
			}
		}
	},
	
	scheduleAll: function(aWindow) {
		// On shutdown, this could cause errors since we do aSync's here and it wouldn't find the object after it's been removed.
		if(UNLOADED) { return; }
		
		if(aWindow.document.readyState != 'complete') {
			windowMediator.callOnLoad(aWindow, function() { 
				aSync(function() { overlayAid.overlayAll(aWindow); });
			});
		}
		else {
			aSync(function() {
				// This still happens sometimes I have no idea why
				if(typeof(overlayAid) == 'undefined') { return; }
				overlayAid.overlayAll(aWindow);
			});
		}
	},
	
	scheduleUnOverlay: function(aWindow, aWith) {
		// On shutdown, this could cause errors since we do aSync's here and it wouldn't find the object after it's been removed.
		if(UNLOADED) { return; }
		
		aSync(function() { 
			if(aWindow) { overlayAid.unOverlayWindow(aWindow, aWith); }
		});
	},
	
	unloadAll: function(aWindow) {
		if(aWindow._OVERLAYS_LOADED) {
			for(var o = aWindow._OVERLAYS_LOADED.length -1; o >= 0; o--) {
				var isFromHere = false;
				for(var i = 0; i < overlayAid.overlays.length; i++) {
					if(aWindow._OVERLAYS_LOADED[o].uri == overlayAid.overlays[i].uri) {
						isFromHere = true;
						break;
					}
				}
				overlayAid.unOverlayWindow(aWindow, aWindow._OVERLAYS_LOADED[o].uri, true, isFromHere);
			}
			delete aWindow._OVERLAYS_LOADED;
			delete aWindow._BEING_OVERLAYED;
		}
	},
	
	traceBack: function(aWindow, traceback, unshift) {
		if(traceback.node) { traceback.nodeID = traceback.node.id; }
		if(traceback.originalParent) { traceback.originalParentID = traceback.originalParent.id; }
		if(traceback.palette) { traceback.paletteID = traceback.palette.id; }
		
		if(!unshift) {
			aWindow._OVERLAYS_LOADED[aWindow._BEING_OVERLAYED].traceBack.push(traceback);
		} else {
			aWindow._OVERLAYS_LOADED[aWindow._BEING_OVERLAYED].traceBack.unshift(traceback);
		}
	},
	
	updateOverlayedNodes: function(aWindow, node, nodeList) {
		if(nodeList != undefined) {
			for(var k = 0; k < nodeList.length; k++) {
				aWindow._OVERLAYS_LOADED[nodeList[k].i].traceBack[nodeList[k].j][nodeList[k].nodeField] = node;
			}
			return true;
		}
		
		nodeList = [];
		for(var i = 0; i < aWindow._OVERLAYS_LOADED.length; i++) {
			for(var j = 0; j < aWindow._OVERLAYS_LOADED[i].traceBack.length; j++) {
				if(aWindow._OVERLAYS_LOADED[i].traceBack[j].node && aWindow._OVERLAYS_LOADED[i].traceBack[j].node == node) {
					nodeList.push({ i: i, j: j, nodeField: 'node' });
				}
				else if(aWindow._OVERLAYS_LOADED[i].traceBack[j].originalParent && aWindow._OVERLAYS_LOADED[i].traceBack[j].originalParent == node) {
					nodeList.push({ i: i, j: j, nodeField: 'originalParent' });
				}
			}
		}
		return nodeList;
	},
	
	unOverlayWindow: function(aWindow, aWith, dontSchedule, isFromHere) {
		if(!dontSchedule && aWindow._BEING_OVERLAYED) {
			this.scheduleUnOverlay(aWindow, aWith);
			return;
		}
		aWindow._BEING_OVERLAYED = true;
		
		if(!isFromHere) {
			isFromHere = false;
		}
		
		var i = this.loadedWindow(aWindow, aWith);
		if(i !== false) {
			for(var j = aWindow._OVERLAYS_LOADED.length -1; j > i; j--) {
				this.removeOverlay(aWindow, j, !isFromHere);
			}
			
			this.removeOverlay(aWindow, i);
			
			if(aWindow._OVERLAYS_LOADED.length == 0) {
				delete aWindow._OVERLAYS_LOADED;
			}
		}
		
		if(!dontSchedule) {
			delete aWindow._BEING_OVERLAYED;
		}
		return;
	},
	
	removeOverlay: function(aWindow, i, reschedule) {
		if(aWindow._OVERLAYS_LOADED[i].onunload) {
			aWindow._OVERLAYS_LOADED[i].onunload(aWindow);
		}
		
		for(var j = aWindow._OVERLAYS_LOADED[i].traceBack.length -1; j >= 0; j--) {
			var action = aWindow._OVERLAYS_LOADED[i].traceBack[j];
			if(action.nodeID) { action.node = action.node || aWindow.document.getElementById(action.nodeID); }
			if(action.originalParentID) { action.originalParent = action.originalParent || aWindow.document.getElementById(action.originalParentID); }
			if(action.paletteID && !action.palette) {
				var toolbox = aWindow.document.querySelectorAll('toolbox');
				for(var a=0; a<toolbox.length; a++) {
					if(toolbox[a].palette && toolbox[a].palette.id == action.paletteID) {
						action.palette = toolbox[a].palette;
						break;
					}
				}
			}
			
			if(action.node) {
				var updateList = this.updateOverlayedNodes(aWindow, action.node);
			}
			
			try {
				switch(action.action) {
					case 'appendChild':
						if(action.node) {
							if(action.originalParent) {
								if(action.originalParent.firstChild.nodeName == 'preferences') {
									var sibling = action.originalParent.firstChild.nextSibling;
								} else {
									var sibling = action.originalParent.firstChild;
								}
								action.node = action.originalParent.insertBefore(action.node, sibling);
							} else if(action.node.parentNode) {
								action.node = action.node.parentNode.removeChild(action.node);
							}
						}
						break;
						
					case 'insertBefore':
						if(action.node && action.originalParent && action.originalPos < action.node.parentNode.childNodes.length) {
							action.node = action.originalParent.insertBefore(action.node, action.originalParent.childNodes[action.originalPos]);
						}
						break;
					
					case 'removeChild':
						if(action.node && action.originalParent) {
							if(action.originalPos < action.originalParent.childNodes.length) {
								action.node = action.originalParent.insertBefore(action.node, action.originalParent.childNodes[action.originalPos]);
							} else {
								action.node = action.originalParent.appendChild(action.node);
							}
						}
						break;
					
					case 'modifyAttribute':
						setAttribute(action.node, action.name, action.value);
						break;
					
					case 'addAttribute':
						removeAttribute(action.node, action.name);
						break;
					
					case 'appendXMLSS':
						if(action.node) {
							action.node = action.node.parentNode.removeChild(action.node);
						}
						break;
					
					case 'addPreferencesElement':
						if(action.prefs) {
							action.prefs.parentNode.removeChild(action.prefs);
						}
						break;
					
					case 'addPreference':
						if(action.pref) {
							// There's an error logged when removing prefs, saying this failed, probably because after performing the removeChild,
							// the pref.preferences property becomes null.
							// I can't get rid of the log message but at least this way nothing should be affected by it failing
							action.pref.preferences.rootBranchInternal.removeObserver(action.pref.name, action.pref.preferences);
							action.pref.parentNode.removeChild(action.pref);
						}
						break;
					
					case 'sizeToContent':
						aWindow.sizeToContent();
						break;
					
					case 'appendButton':
						closeCustomize();
						
						if(action.node) {
							action.node = action.node.parentNode.removeChild(action.node);
						}
						break;
					
					case 'removeButton':
						closeCustomize();
						
						if(action.node && action.palette) {
							action.node = action.palette.appendChild(action.node);
							
							var toolbars = aWindow.document.querySelectorAll("toolbar");
							toolbar_loop: for(var a=0; a<toolbars.length; a++) {
								var currentset = toolbars[a].getAttribute('currentset').split(",");
								if(currentset.indexOf(action.node.id) > -1) {
									for(var e=0; e<currentset.length; e++) {
										if(currentset[e] == action.node.id) {
											for(var l=e+1; l<currentset.length; l++) {
												var beforeEl = aWindow.document.getElementById(currentset[l]);
												if(beforeEl) {
													toolbars[a].insertItem(action.node.id, beforeEl);
													break toolbar_loop;
												}
											}
											toolbars[a].insertItem(action.node.id, null, null, false);
											break toolbar_loop;
										}
									}
								}
							}
						}
						break;
					
					case 'insertItem':
						closeCustomize();
						
						if(action.node && action.palette) {
							action.node = action.palette.appendChild(action.node);
						}
						break;
											
					default: break;
				}
			} catch(ex) {
				Cu.reportError(ex);
			}
			
			if(action.node) {
				this.updateOverlayedNodes(aWindow, action.node, updateList);
			}
		}
		
		this.startPreferences(aWindow);
		
		if(!aWindow._OVERLAYS_LOADED[i].document || aWindow._OVERLAYS_LOADED[i].remove) {
			aWindow._OVERLAYS_LOADED.splice(i, 1);
		} else if(aWindow._OVERLAYS_LOADED[i].document) {
			aWindow._OVERLAYS_LOADED[i].loaded = false;
		}
		if(reschedule) {
			this.scheduleAll(aWindow);
		}
	},
	
	overlayAll: function(aWindow) {
		if(aWindow._BEING_OVERLAYED) {
			this.scheduleAll(aWindow);
			return;
		}
		aWindow._BEING_OVERLAYED = true;
		var rescheduleOverlay = false;
		
		if(aWindow._OVERLAYS_LOADED == undefined) {
			aWindow._OVERLAYS_LOADED = [];
		}
		
		for(var i=0; i<aWindow._OVERLAYS_LOADED.length; i++) {
			if(aWindow._OVERLAYS_LOADED[i].document && !aWindow._OVERLAYS_LOADED[i].loaded) {
				aWindow._BEING_OVERLAYED = i;
				this.overlayDocument(aWindow, aWindow._OVERLAYS_LOADED[i]);
				aWindow._OVERLAYS_LOADED[i].loaded = true;
			}
		}
		
		for(var i=0; i<this.overlays.length; i++) {
			if(this.overlays[i].document
			&& (this.overlays[i].uri == aWindow.document.baseURI || this.loadedWindow(aWindow, this.overlays[i].uri) !== false)
			&& this.loadedWindow(aWindow, this.overlays[i].overlay) === false) {
				aWindow._BEING_OVERLAYED = aWindow._OVERLAYS_LOADED.push({
					uri: this.overlays[i].overlay,
					traceBack: [],
					onunload: this.overlays[i].onunload
				}) -1;
				
				this.overlayDocument(aWindow, this.overlays[i]);
				rescheduleOverlay = true;
			}
		}
		
		if(aWindow._OVERLAYS_LOADED.length == 0) {
			delete aWindow._OVERLAYS_LOADED;
		}
		delete aWindow._BEING_OVERLAYED;
		
		// Re-schedule overlaying the window to load overlays over newly loaded overlays if necessary
		if(rescheduleOverlay) {
			this.scheduleAll(aWindow);
		}
		
		return;
	},
	
	overlayDocument: function(aWindow, overlay) {
		if(overlay.beforeload) {
			overlay.beforeload(aWindow);
		}
		
		for(var o = 0; o < overlay.document.childNodes.length; o++) {
			if(overlay.document.childNodes[o].nodeName == 'window') {
				continue;
			}
			
			if(overlay.document.childNodes[o].nodeName == 'overlay') {
				this.loadInto(aWindow, overlay.document.childNodes[o]);
			}
			
			else if(overlay.document.childNodes[o].nodeName == 'xml-stylesheet') {
				this.appendXMLSS(aWindow, overlay.document.childNodes[o]);
			}
		}
		
		// Have to set the correct values into modified preferences
		this.startPreferences(aWindow);
		
		// Resize the preferences dialogs to fit the content
		this.sizeToContent(aWindow);
		
		this.persistOverlay(aWindow, overlay);
		
		if(overlay.onload) {
			overlay.onload(aWindow);
		}
	},
	
	loadInto: function(aWindow, overlay) {
		for(var i = 0; i < overlay.childNodes.length; i++) {
			var overlayNode = overlay.childNodes[i];
			
			// Special case for overlaying preferences to options dialogs
			if(overlayNode.nodeName == 'preferences') {
				this.addPreferences(aWindow, overlay.childNodes[i]);
				continue;
			}
			
			// Overlaying script elements when direct children of the overlay element
			// With src attribute we import it as a subscript of aWindow, otherwise we eval the inline content of the script tag
			if(overlayNode.nodeName == 'script' && overlay.nodeName == 'overlay') {
				if(overlayNode.hasAttribute('src')) {
					Services.scriptloader.loadSubScript(overlayNode.getAttribute('src'), aWindow);
				} else {
					aWindow.eval(overlayNode.textContent);
				}
				continue;
			}
			
			// No id means the node won't be processed
			if(!overlayNode.id) { continue; }
			
			// Correctly add or remove toolbar buttons to the toolbox palette
			if(overlayNode.nodeName == 'toolbarpalette') {
				var toolbox = aWindow.document.querySelectorAll('toolbox');
				for(var a=0; a<toolbox.length; a++) {
					if(toolbox[a].palette && toolbox[a].palette.id == overlayNode.id) {
						buttons_loop: for(var e=0; e<overlayNode.childNodes.length; e++) {
							var button = aWindow.document.importNode(overlayNode.childNodes[e]);
							if(button.id) {
								// change or remove the button on the toolbar if it is found in the document
								var existButton = aWindow.document.getElementById(button.id);
								if(existButton) {
									if(button.getAttribute('removeelement') == 'true') {
										this.removeButton(aWindow, toolbox[a].palette, existButton);
										continue buttons_loop;
									}
									
									for(var c=0; c<button.attributes.length; c++) {
										// Why bother, id is the same already
										if(button.attributes[c].name == 'id') { continue; }
										
										this.setAttribute(aWindow, existButton, button.attributes[c]);
									}
									continue buttons_loop;
								}
								
								// change or remove in the palette if it exists there
								for(var b=0; b<toolbox[a].palette.childNodes.length; b++) {
									if(toolbox[a].palette.childNodes[b].id == button.id) {
										if(button.getAttribute('removeelement') == 'true') {
											this.removeButton(aWindow, toolbox[a].palette, toolbox[a].palette.childNodes[b]);
											continue buttons_loop;
										}
										
										for(var c=0; c<button.attributes.length; c++) {
											// Why bother, id is the same already
											if(button.attributes[c].name == 'id') { continue; }
											
											this.setAttribute(aWindow, toolbox[a].palette.childNodes[b], button.attributes[c]);
										}
										continue buttons_loop;
									}
								}
								
								// add the button if not found either in a toolbar or the palette
								this.appendButton(aWindow, toolbox[a].palette, button);
							}
						}
						break;
					}
				}
				continue;
			}
			
			var node = aWindow.document.getElementById(overlayNode.id);
			// Handle if node with same id was found
			
			if(node) {
				// Don't process if id mismatches nodename or if parents mismatch; I should just make sure this doesn't happen in my overlays
				if(node.nodeName != overlayNode.nodeName) { continue; }
				if(overlayNode.parentNode.nodeName != 'overlay' && node.parentNode.id != overlayNode.parentNode.id) { continue; }
				
				// If removeelement attribute is true, remove the element and do nothing else
				if(overlayNode.getAttribute('removeelement') == 'true') {
					this.removeChild(aWindow, node);
					continue;
				}
				
				// Copy attributes to node
				for(var a = 0; a < overlayNode.attributes.length; a++) {
					// Why bother, id is the same already
					if(overlayNode.attributes[a].name == 'id') { continue; }
					
					this.setAttribute(aWindow, node, overlayNode.attributes[a]);
				}
				
				// Move the node around if necessary
				node = this.moveAround(aWindow, node, overlayNode, node.parentNode);
				
				// Get Children of an Element's ID into this node
				this.getChildrenOf(aWindow, node);
				
				// Load children of the overlayed node
				this.loadInto(aWindow, overlay.childNodes[i]);
			}
			else if(overlayNode.parentNode.nodeName != 'overlay') {
				var node = aWindow.document.importNode(overlayNode);
				
				// Add the node to the correct place
				node = this.moveAround(aWindow, node, overlayNode, aWindow.document.getElementById(overlayNode.parentNode.id));
				
				// Get Children of an Element's ID into this node
				this.getChildrenOf(aWindow, node);
				
				// Surf through all the children of node for the getchildrenof attribute
				var allGetChildrenOf = node.getElementsByAttribute('getchildrenof', '*');
				for(var gco = 0; gco < allGetChildrenOf.length; gco++) {
					this.getChildrenOf(aWindow, allGetChildrenOf[gco]);
				}
			}
		}
	},
	
	moveAround: function(aWindow, node, overlayNode, parent) {
		if(overlayNode.getAttribute('insertafter')) {
			var idList = overlayNode.getAttribute('insertafter').split(',');
			for(var i = 0; i < idList.length; i++) {
				var id = trim(idList[i]);
				if(id == '') { continue; }
				if(id == node.id) { continue; } // this is just stupid of course...
				
				for(var c = 0; c < parent.childNodes.length; c++) {
					if(parent.childNodes[c].id == id) {
						return this.insertBefore(aWindow, node, parent, parent.childNodes[c].nextSibling);
					}
				}
			}
		}
		
		if(overlayNode.getAttribute('insertbefore')) {
			var idList = overlayNode.getAttribute('insertbefore').split(',');
			for(var i = 0; i < idList.length; i++) {
				var id = trim(idList[i]);
				if(id == '') { continue; }
				if(id == node.id) { continue; } // this is just stupid of course...
				
				for(var c = 0; c < parent.childNodes.length; c++) {
					if(parent.childNodes[c].id == id) {
						return this.insertBefore(aWindow, node, parent, parent.childNodes[c]);
					}
				}
			}
		}
		
		if(overlayNode.getAttribute('position')) {
			var position = parseInt(overlayNode.getAttribute('position')) -1; // one-based children list
			var sibling = (sibling < parent.childNodes.length) ? node.parentNode.childNodes[position] : null;
			return this.insertBefore(aWindow, node, parent, sibling);
		}
		
		if(!node.parentNode) {
			return this.appendChild(aWindow, node, parent);
		}
		return node;
	},
	
	getChildrenOf: function(aWindow, node) {
		var getID = node.getAttribute('getchildrenof');
		if(!getID) { return; }
		
		getID = getID.split(',');
		for(var i = 0; i < getID.length; i++) {
			var getNode = aWindow.document.getElementById(trim(getID[i]));
			if(!getNode) { continue; }
			
			var curChild = 0;
			while(curChild < getNode.childNodes.length) {
				if(getNode.childNodes[curChild].nodeName == 'preferences' || isAncestor(node, getNode.childNodes[curChild])) {
					curChild++;
					continue;
				}
				
				this.appendChild(aWindow, getNode.childNodes[curChild], node);
			}
		}
	},
	
	appendChild: function(aWindow, node, parent) {
		var originalParent = node.parentNode;
		var updateList = this.updateOverlayedNodes(aWindow, node);
		
		try { node = parent.appendChild(node); } catch(ex) { node = null; }
		
		this.updateOverlayedNodes(aWindow, node, updateList);
		this.traceBack(aWindow, {
			action: 'appendChild',
			node: node,
			originalParent: originalParent
		});
		return node;
	},
	
	insertBefore: function(aWindow, node, parent, sibling) {
		var originalParent = node.parentNode;
		
		if(originalParent) {
			for(var o = 0; o < originalParent.childNodes.length; o++) {
				if(originalParent.childNodes[o] == node) {
					break;
				}
			}
		}
		var updateList = this.updateOverlayedNodes(aWindow, node);
		
		try { node = parent.insertBefore(node, sibling); } catch(ex) { node = null; }
		
		this.updateOverlayedNodes(aWindow, node, updateList);
		if(!originalParent) {
			this.traceBack(aWindow, {
				action: 'appendChild',
				node: node,
				originalParent: null
			});
		} else {
			this.traceBack(aWindow, {
				action: 'insertBefore',
				node: node,
				originalParent: originalParent,
				originalPos: o
			});
		}
		
		return node;
	},
	
	removeChild: function(aWindow, node) {
		var updateList = this.updateOverlayedNodes(aWindow, node);
		var originalParent = node.parentNode;
		
		var o = 0;
		if(node.parentNode) {
			for(o = 0; o < node.parentNode.childNodes.length; o++) {
				if(node.parentNode.childNodes[o] == node) {
					break;
				}
			}
		}
		
		try { node = node.parentNode.removeChild(node); } catch(ex) { node = null; }
		
		this.updateOverlayedNodes(aWindow, node, updateList);
		this.traceBack(aWindow, {
			action: 'removeChild',
			node: node,
			originalParent: originalParent,
			originalPos: o
		});
		return node;
	},
	
	setAttribute: function(aWindow, node, attr) {
		if(node.hasAttribute(attr.name)) {
			this.traceBack(aWindow, {
				action: 'modifyAttribute',
				node: node,
				name: attr.name,
				value: node.getAttribute(attr.name)
			});
		} else {
			this.traceBack(aWindow, {
				action: 'addAttribute',
				node: node,
				name: attr.name
			});
		}
		
		try { node.setAttribute(attr.name, attr.value); } catch(ex) {}
	},
	
	appendXMLSS: function(aWindow, node) {
		try {
			node = aWindow.document.importNode(node);
			// these have to come before the actual window element
			node = aWindow.document.insertBefore(node, aWindow.document.documentElement);
		} catch(ex) { node = null; }
		this.traceBack(aWindow, {
			action: 'appendXMLSS',
			node: node
		});
		return node;
	},
	
	addPreferences: function(aWindow, node) {
		var prefPane = aWindow.document.getElementById(node.parentNode.id);
		if(!prefPane) { return; }
		
		var prefElements = prefPane.getElementsByTagName('preferences');
		if(prefElements.length == 0) {
			try {
				var prefs = aWindow.document.importNode(node);
				prefs = prefPane.appendChild(prefs);
			} catch(ex) { prefs = null; }
			this.traceBack(aWindow, {
				action: 'addPreferencesElement',
				prefs: prefs
			});
			return;
		}
		
		var prefs = prefElements[0];
		for(var p = 0; p < node.childNodes.length; p++) {
			if(!node.childNodes[p].id) { continue; }
			
			try {
				var pref = aWindow.document.importNode(node.childNodes[p]);
				pref = prefs.appendChild(pref);
			} catch(ex) { pref = null; }
			this.traceBack(aWindow, {
				action: 'addPreference',
				pref: pref
			});
		}
	},
	
	startPreferences: function(aWindow) {
		var prefs = aWindow.document.getElementsByTagName('preference');
		for(var i = 0; i < prefs.length; i++) {
			// Overlayed preferences have a null value, like they haven't been initialized for some reason, this takes care of that
			if(prefs[i].value === null) {
				prefs[i].value = prefs[i].valueFromPreferences;
			}
			try { prefs[i].updateElements(); } catch(ex) {}
		}
	},
	
	sizeToContent: function(aWindow) {
		var isPrefDialog = aWindow.document.getElementsByTagName('prefwindow');
		if(isPrefDialog.length > 0 && isPrefDialog[0].parentNode == aWindow.document) {
			try { aWindow.sizeToContent(); } catch(ex) {}
			this.traceBack(aWindow, { action: 'sizeToContent' }, true);
		}
	},
	
	appendButton: function(aWindow, palette, node) {
		closeCustomize();
		var updateList = this.updateOverlayedNodes(aWindow, node);
		
		node = palette.appendChild(node);
		
		var toolbars = aWindow.document.querySelectorAll("toolbar");
		toolbar_loop: for(var a=0; a<toolbars.length; a++) {
			var currentset = toolbars[a].getAttribute('currentset').split(",");
			if(currentset.indexOf(node.id) > -1) {
				for(var e=0; e<currentset.length; e++) {
					if(currentset[e] == node.id) {
						for(var i=e+1; i<currentset.length; i++) {
							var beforeEl = aWindow.document.getElementById(currentset[i]);
							if(beforeEl) {
								toolbars[a].insertItem(node.id, beforeEl);
								break toolbar_loop;
							}
						}
						toolbars[a].insertItem(node.id, null, null, false);
						break toolbar_loop;
					}
				}
			}
		}
		
		this.updateOverlayedNodes(aWindow, node, updateList);
		this.traceBack(aWindow, {
			action: 'appendButton',
			node: node
		});
		return node;
	},
	
	removeButton: function(aWindow, palette, node) {
		closeCustomize();
		var updateList = this.updateOverlayedNodes(aWindow, node);
		
		node = node.parentNode.removeChild(node);
		
		this.updateOverlayedNodes(aWindow, node, updateList);
		this.traceBack(aWindow, {
			action: 'removeButton',
			node: node,
			palette: palette
		});
	},
	
	insertItem: function(aWindow, toolbar, node) {
		closeCustomize();
		
		var palette = node.parentNode;
		
		toolbar.insertItem(node);
		
		this.traceBack(aWindow, {
			action: 'insertItem',
			node: node,
			palette: palette
		});
	}	
};

// stringsAid - use for getting strings out of bundles from .properties locale files
// get(bundle, string, replace) - returns the desired string
//	bundle - (string) name of the bundle to retrieve the string from, just aBundle in chrome://objPathString/locale/aBundle.properties
//	string - (string) name of the string to retrieve from bundle
//	(optional) replace - (array) [ [original, new] x n ] retrieves the string with the occurences of original replaced with new
//	(dont set) alt - don't set this variable, it is for internal use so the method know it needs to look in a special location for en locales, like in the case of
//			 untranslated strings, this should be set in chrome.manifest as objPathString-en to the en-US locale.
this.stringsAid = {
	bundles: {},
	
	getPath: function(aPath, alt) {
		return "chrome://"+objPathString+((alt) ? '-en' : '')+"/locale/"+aPath+".properties";
	},
	
	get: function(bundle, string, replace, alt) {
		var bundleObj = bundle;
		if(alt) { bundleObj += '-en'; }
		
		if(!this.bundles[bundleObj]) {
			this.bundles[bundleObj] = Services.strings.createBundle(this.getPath(bundle, alt));
		}
		
		try { string = this.bundles[bundleObj].GetStringFromName(string); }
		catch(ex) {
			if(!alt) {
				var myex = 'Failed to load string from properties file. [Addon: '+objPathString+'] [File: '+bundle+'] [String: '+string+']';
				try {
					string = this.get(bundle, string, replace, true);
					if(string !== null) {
						Services.console.logStringMessage(myex + ' [Successfully loaded en backup]');
					} else {
						Cu.reportError(myex + ' [Failed to load en backup]');
						string = '';
					}
					return string;
				}
				catch(exx) {
					Cu.reportError(myex + ' [Failed to load en backup]');
					return '';
				}
			}
			else { return null; }
		}
		
		if(replace) {
			for(var i = 0; i < replace.length; i++) {
				while(string.indexOf(replace[i][0] > -1)) {
					string.replace(replace[i][0], replace[i][1]);
				}
			}
		}
		
		return string;
	}
};		

// xmlHttpRequest(url, callback, method, async) - aid for quickly using the nsIXMLHttpRequest interface
//	url - (string) to send the request
//	callback - (function) to be called after request is completed; expects callback(xmlhttp, e) where xmlhttp = xmlhttprequest return object and e = event object
//	(optional) method - either (string) "POST" or (string) "GET"
//	(optional) async - (bool) defines whether to perform the operation asynchronously, defaults to true
this.xmlHttpRequest = function(url, callback, method, async) {
	if(!method) { method = "GET"; }
	if(async !== false) { async = true; }
	
	var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
	xmlhttp.open(method, url, async);
	if(async) {
		xmlhttp.onreadystatechange = function(e) { callback(xmlhttp, e); };
	}
	xmlhttp.send();
	if(!async) {
		callback(xmlhttp);
	}
	return xmlhttp;
};

// aSync(aFunc, aDelay) - lets me run aFunc asynchronously, basically it's a one shot timer with a delay of aDelay msec
//	aFunc - (function) to be called asynchronously
//	(optional) aDelay - (int) msec to set the timer, defaults to 0msec
this.aSync = function(aFunc, aDelay) {
	var newTimer = {
		timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
		handler: aFunc.bind(self),
		cancel: function() {
			this.timer.cancel();
		}
	};
	newTimer.timer.init(newTimer.handler, (!aDelay) ? 0 : aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
	return newTimer;
};

// objectWatcher - This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
//	addPropertyWatcher(obj, prop, handler, capture) - registers handler as a watcher for obj property prop changes
//		obj - (xul element or object) to watch for changes
//		prop - (string) property name in obj to watch
//		handler - (function) method to fire when prop is set or changed
//		(optional) capture - when (bool) true it cancels setting the property if handler returns (bool) false, defaults to (bool) false
//	removePropertyWatcher(obj, prop, handler, capture) - unregisters handler as a watcher for prop changes
//		see addPropertyWatcher()
//	addAttributeWatcher(obj, attr, handler, capture) - registers handler as a watcher for object attribute attr changes
//		obj - (xul element or object) to watch for changes
//		attr - (string) attribute name in obj to watch
//		handler - (function) method to fire when attr is set, removed or changed
//		(optional) capture - when (bool) true it cancels setting the attribute if handler returns (bool) false, defaults to (bool) false
//	removeAttributeWatcher(obj, attr, handler, capture) - unregisters handler as a watcher for object attribute attr changes
//		see addAttributeWatcher()
// All handlers expect function(prop, oldVal, newVal), where:
//	prop - (string) name of the property or attribute being set or changed
//	oldVal - the current value of prop
//	newVal - the new value of prop
// Note: deleting a watched property does not trigger the watchers, so don't do it! Also setting the watchers on an unset property won't work either.
// I can't do anything when setting attributes from within the obj.attributes object.
this.objectWatcher = {
	// Properties part, works by replacing the get and set accessor methods of a property with custom ones
	addPropertyWatcher: function(obj, prop, handler, capture) {
		if(typeof(obj[prop]) == 'undefined' || !this.setWatchers(obj)) { return false; }
		capture = (capture) ? true : false;
		
		if(typeof(obj._propWatchers.properties[prop]) == 'undefined') {
			var tempVal = obj[prop];
			// can't watch constants
			if(!(delete obj[prop])) {
				this.unsetWatchers(obj);
				return false;
			}
			
			obj._propWatchers.properties[prop] = {
				value: tempVal,
				handlers: []
			};
			obj._propWatchers.properties[prop].handlers.push({ handler: handler, capture: capture });
			
			obj.__defineGetter__(prop, function () { return this._propWatchers.properties[prop].value; });
			obj.__defineSetter__(prop, function (newVal) {
				var oldVal = this._propWatchers.properties[prop].value;
				for(var i = 0; i < this._propWatchers.properties[prop].handlers.length; i++) {
					if(this._propWatchers.properties[prop].handlers[i].capture) {
						if(this._propWatchers.properties[prop].handlers[i].handler(prop, oldVal, newVal) === false) {
							return this._propWatchers.properties[prop].value;
						}
					}
				}
				this._propWatchers.properties[prop].value = newVal;
				for(var i = 0; i < this._propWatchers.properties[prop].handlers.length; i++) {
					if(!this._propWatchers.properties[prop].handlers[i].capture) {
						this._propWatchers.properties[prop].handlers[i].handler(prop, oldVal, newVal);
					}
				}
				return this._propWatchers.properties[prop].value;
			});
		}
		else {
			for(var i=0; i<obj._propWatchers.properties[prop].handlers.length; i++) {
				if(compareFunction(obj._propWatchers.properties[prop].handlers[i].handler, handler)
				&& capture == obj._propWatchers.properties[prop].handlers[i].capture) { return false; }
			}
			obj._propWatchers.properties[prop].handlers.push({ handler: handler, capture: capture });
		}
		
		obj._propWatchers.setters++;
		return true;
	},
	
	removePropertyWatcher: function(obj, prop, handler, capture) {
		if(!obj._propWatchers || typeof(obj._propWatchers.properties[prop]) == 'undefined') { return false; }
		capture = (capture) ? true : false;
		
		for(var i=0; i<obj._propWatchers.properties[prop].handlers.length; i++) {
			if(compareFunction(obj._propWatchers.properties[prop].handlers[i].handler, handler)
			&& capture == obj._propWatchers.properties[prop].handlers[i].capture) {
				obj._propWatchers.properties[prop].handlers.splice(i, 1);
				if(obj._propWatchers.properties[prop].handlers.length == 0) {
					delete obj[prop]; // remove accessors
					obj[prop] = obj._propWatchers.properties[prop].value;
					delete obj._propWatchers.properties[prop];
				}
				
				obj._propWatchers.setters--;
				this.unsetWatchers(obj);
				return true;
			}
		}
		
		return false;
	},
	
	// Attributes part, works by replacing the actual attribute native functions with custom ones (while still using the native ones)
	addAttributeWatcher: function(obj, attr, handler, capture) {
		if(!this.setWatchers(obj)) { return false; }
		capture = (capture) ? true : false;
		
		if(typeof(obj._propWatchers.attributes[attr]) == 'undefined') {
			obj._propWatchers.attributes[attr] = {
				value: (obj.hasAttribute(attr)) ? obj.getAttribute(attr) : null,
				handlers: []
			};
			obj._propWatchers.attributes[attr].handlers.push({ handler: handler, capture: capture });
		}
		else {
			for(var i=0; i<obj._propWatchers.attributes[attr].handlers.length; i++) {
				if(compareFunction(obj._propWatchers.attributes[attr].handlers[i].handler, handler)
				&& capture == obj._propWatchers.attributes[attr].handlers[i].capture) { return false; }
			}
			obj._propWatchers.attributes[attr].handlers.push({ handler: handler, capture: capture });
		}
		
		obj._propWatchers.setters++;
		return true;
	},
	
	removeAttributeWatcher: function(obj, attr, handler, capture) {
		if(!obj._propWatchers || typeof(obj._propWatchers.attributes[attr]) == 'undefined') { return false; }
		capture = (capture) ? true : false;
		
		for(var i=0; i<obj._propWatchers.attributes[attr].handlers.length; i++) {
			if(compareFunction(obj._propWatchers.attributes[attr].handlers[i].handler, handler)
			&& capture == obj._propWatchers.attributes[attr].handlers[i].capture) {
				obj._propWatchers.attributes[attr].handlers.splice(i, 1);
				if(obj._propWatchers.attributes[attr].handlers.length == 0) {
					delete obj._propWatchers.attributes[attr];
				}
				
				obj._propWatchers.setters--;
				this.unsetWatchers(obj);
				return true;
			}
		}
		
		return false;
	},
	
	setWatchers: function(obj) {
		if(!obj || typeof(obj) != 'object') { return false; }
		
		if(obj._propWatchers) { return true; }
		
		obj._propWatchers = {
			setters: 0,
			properties: {},
			attributes: {},
			callAttrWatchers: function(attr, newVal, capture) {
				if(typeof(this.attributes[attr]) == 'undefined') { return true; }
				
				var oldVal = this.attributes[attr].value;
				
				for(var i = 0; i < this.attributes[attr].handlers.length; i++) {
					if(this.attributes[attr].handlers[i].capture == capture) {
						if(capture) {
							if(this.attributes[attr].handlers[i].handler(attr, oldVal, newVal) === false) { return false; }
						} else {
							this.attributes[attr].handlers[i].handler(attr, oldVal, newVal);
						}
					}
				}
				
				if(!capture) {
					this.attributes[attr].value = newVal;
				}
				
				return true;
			}
		};
		
		// Store all native functions as '_function' and set custom ones to handle attribute changes
		obj._setAttribute = obj.setAttribute;
		obj._setAttributeNS = obj.setAttributeNS;
		obj._setAttributeNode = obj.setAttributeNode;
		obj._setAttributeNodeNS = obj.setAttributeNodeNS;
		obj._removeAttribute = obj.removeAttribute;
		obj._removeAttributeNS = obj.removeAttributeNS;
		obj._removeAttributeNode = obj.removeAttributeNode;
		
		obj.setAttribute = function setAttribute(attr, value) {
			if(!this._propWatchers.callAttrWatchers(attr, value, true)) { return; }
			this._setAttribute(attr, value);
			this._propWatchers.callAttrWatchers(attr, value, false);
		};
		obj.setAttributeNS = function(namespace, attr, value) {
			if(!this._propWatchers.callAttrWatchers(attr, value, true)) { return; }
			this._setAttributeNS(namespace, attr, value);
			this._propWatchers.callAttrWatchers(attr, value, false);
		};
		obj.setAttributeNode = function(attr) {
			if(!this._propWatchers.callAttrWatchers(attr.name, attr.value, true)) { return null; }
			var ret = this._setAttributeNode(attr);
			this._propWatchers.callAttrWatchers(attr.name, attr.value, false);
			return ret;
		};
		obj.setAttributeNodeNS = function(attr) {
			if(!this._propWatchers.callAttrWatchers(attr.name, attr.value, true)) { return null; }
			var ret = this._setAttributeNodeNS(attr);
			this._propWatchers.callAttrWatchers(attr.name, attr.value, false);
			return ret;
		};
		obj.removeAttribute = function removeAttribute(attr) {
			if(!this._propWatchers.callAttrWatchers(attr, null, true)) { return; }
			this._removeAttribute(attr);
			this._propWatchers.callAttrWatchers(attr, null, false);
		};
		obj.removeAttributeNS = function(namespace, attr) {
			if(!this._propWatchers.callAttrWatchers(attr, null, true)) { return; }
			this._removeAttributeNS(namespace, attr);
			this._propWatchers.callAttrWatchers(attr, null, false);
		};
		obj.removeAttributeNode = function(attr) {
			if(!this._propWatchers.callAttrWatchers(attr.name, null, true)) { return null; }
			var ret = this._removeAttributeNode(attr);
			this._propWatchers.callAttrWatchers(attr.name, null, false);
			return ret;
		};
		
		return true;
	},
	
	unsetWatchers: function(obj) {
		if(typeof(obj) != 'object' || obj === null || !obj._propWatchers || obj._propWatchers.setters > 0) { return false; }
		
		obj.setAttribute = obj._setAttribute;
		obj.setAttributeNS = obj._setAttributeNS;
		obj.setAttributeNode = obj._setAttributeNode;
		obj.setAttributeNodeNS = obj._setAttributeNodeNS;
		obj.removeAttribute = obj._removeAttribute;
		obj.removeAttributeNS = obj._removeAttributeNS;
		obj.removeAttributeNode = obj._removeAttributeNode;
		delete obj._setAttribute;
		delete obj._setAttributeNS;
		delete obj._setAttributeNode;
		delete obj._setAttributeNodeNS;
		delete obj._removeAttribute;
		delete obj._removeAttributeNS;
		delete obj._removeAttributeNode;
		
		delete obj._propWatchers;
		
		return true;
	}
};

// dispatch(obj, properties) - creates and dispatches an event and returns (bool) whether preventDefault was called on it
//	obj - (xul element) object to dispatch the event from, it will be e.target
//	properties - (obj) expecting the following sub properties defining the following event characteristics:
//		type - (str) the event type
//		(optional) bubbles - (bool) defaults to true
//		(optional) cancelable - (bool) defaults to true
this.dispatch = function(obj, properties) {
	if(!obj || !obj.ownerDocument || !obj.dispatchEvent || !properties || !properties.type) { return false; }
	
	var bubbles = properties.bubbles || true;
	var cancelable = properties.cancelable || true;
	
	var event = obj.ownerDocument.createEvent('Event');
	event.initEvent(properties.type, bubbles, cancelable);
	return obj.dispatchEvent(event);
};

// compareFunction(a, b, strict) - returns (bool) if a === b
//	a - (function) to compare
//	b - (function) to compare
//	(optional) strict - false compares function source as (string), true does not, defaults to false
this.compareFunction = function(a, b, strict) {
	if(a === b || (!strict && a.toSource() == b.toSource())) {
		return true;
	}
	return false;
};

// isAncestor(aNode, aParent, aWindow) - Checks if aNode decends from aParent
//	aNode - (xul element) node to check for ancestry
//	aParent - (xul element) node to check if ancestor of aNode
//	(dont set) aWindow - to be used internally by isAncestor()
this.isAncestor = function(aNode, aParent, aWindow) {
	if(!aNode || !aParent) { return false; };
	
	if(aNode == aParent) { return true; }
	
	var ownDocument = aNode.ownerDocument || aNode.document;
	if(ownDocument && ownDocument == aParent) { return true; }
	if(aNode.compareDocumentPosition && (aNode.compareDocumentPosition(aParent) & aNode.DOCUMENT_POSITION_CONTAINS)) { return true; }
	
	var browsers = aParent.getElementsByTagName('browser');
	for(var i=0; i<browsers.length; i++) {
		if(isAncestor(aNode, browsers[i].contentDocument, browsers[i].contentWindow)) { return true; }
	}
	
	if(!aWindow) { return false; }
	for(var i=0; i<aWindow.frames.length; i++) {
		if(isAncestor(aNode, aWindow.frames[i].document, aWindow.frames[i])) { return true; }
	}
	return false;
};

// hideIt(aNode, show) - in theory this should collapse whatever I want
//	aNode - (xul element) node to collapse
//	(optional) show - false collapses aNode, true 'un'collapses it, defaults to false
this.hideIt = function(aNode, show) {
	toggleAttribute(aNode, 'collapsed', !show);
};

// trim(str) - trims whitespaces from a string (found in http://blog.stevenlevithan.com/archives/faster-trim-javascript -> trim3())
//	str - (string) to trim
this.trim = function(str) {
	if(typeof(str) != 'string') {
		return '';
	}
	
	return str.substring(Math.max(str.search(/\S/), 0), str.search(/\S\s*$/) + 1);
};

// closeCustomize() - useful for when you want to close the customize toolbar dialogs for whatever reason
this.closeCustomize = function() {
	windowMediator.callOnAll(function(aWindow) { try { aWindow.close(); } catch(ex) {} }, null, "chrome://global/content/customizeToolbar.xul");
};

// setAttribute(obj, attr, val) - helper me that saves me the trouble of checking if the obj exists first everywhere in my scripts; yes I'm that lazy
//	obj - (xul element) to set the attribute
//	attr - (str) attribute to set
//	val - (str) value to set for attr
this.setAttribute = function(obj, attr, val) {
	if(!obj) { return; }
	obj.setAttribute(attr, val);
};

// removeAttribute(obj, attr) - helper me that saves me the trouble of checking if the obj exists first everywhere in my scripts; yes I'm that lazy
//	see setAttribute()
this.removeAttribute = function(obj, attr) {
	if(!obj) { return; }
	obj.removeAttribute(attr);
};

// toggleAttribute(obj, attr, condition, val) - sets attr on obj if condition is true; I'm uber lazy
//	see setAttribute()
//	condition - when true, attr is set with value (str) true, otherwise it removes the attribute
//	(optional) trueval - (str) value to set attr to if condition is true, defaults to (str) true
//	(optional) falseval - (str) value to set attr to if condition is false, if not set the attr is removed
this.toggleAttribute = function(obj, attr, condition, trueval, falseval) {
	if(!obj) { return; }
		
	if(condition) {
		if(!trueval) { trueval = 'true'; }
		obj.setAttribute(attr, trueval);
	} else {
		if(!falseval) {
			obj.removeAttribute(attr);
		} else {
			obj.setAttribute(attr, falseval);
		}
	}
};

moduleAid.LOADMODULE = function() {
	// This is so the observers aren't called twice on quitting sometimes
	observerAid.add(function() { observerAid.hasQuit = true; }, 'quit-application');
	Services.ww.registerNotification(windowMediator.callWatchers);
	windowMediator.register(overlayAid.scheduleAll, 'domwindowopened');
};

moduleAid.UNLOADMODULE = function() {
	observerAid.clean();
	windowMediator.callOnAll(overlayAid.unloadAll);
	Services.ww.unregisterNotification(windowMediator.callWatchers);
	prefAid.clean();
	moduleAid.clean();
};
