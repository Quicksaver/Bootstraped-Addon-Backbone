moduleAid.VERSION = '1.0.7';
moduleAid.VARSLIST = ['prefAid', 'styleAid', 'windowMediator', 'window', 'document', 'observerAid', 'privateBrowsingAid', 'overlayAid', 'stringsAid', 'xmlHttpRequest', 'aSync', 'setWatchers', 'compareFunction', 'isAncestor', 'hideIt', 'trim'];

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
// callOnAll(aCallback, aType, beforeComplete) - goes through every opened browser window of aType and executes aCallback on it
//	(optional) beforeComplete - true calls aCallback immediatelly regardless of readyState, false fires aCallback when window loads if readyState != complete, defaults to false
//	see callOnMostRecent()
// callOnLoad(window, aCallback, aType) - calls aCallback when load event is fired on that window
//	window - (xul object) window object to execute aCallback on
//	see callOnMostRecent()
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
	callOnAll: function(aCallback, aType, beforeComplete) {
		var browserEnumerator = this.getEnumerator(aType);
		while(browserEnumerator.hasMoreElements()) {
			var window = browserEnumerator.getNext();
			if(window.document.readyState == "complete" || beforeComplete) {
				aCallback(window);
			} else {
				this.callOnLoad(window, aCallback);
			}
		}
	},
	
	callOnLoad: function(window, aCallback, aType) {
		window.addEventListener('load', function runOnce() {
			window.removeEventListener('load', runOnce, false);
			if(!unloaded && (!aType || window.document.documentElement.getAttribute('windowtype') == aType)) {
				aCallback(window);
			}
		}, false);
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
// overlayURI(aURI, aWith, onload, onunload) - overlays aURI with aWith
//	aURI - (string) uri to be overlayed
//	aWith - (string) uri to overlay aURI, can be fileName found as chrome://objPathString/content/fileName.xul or already the full uri path
//	(optional) beforeload ( function(window) ) is called before the window is overlayed, expects a (object) window argument
//	(optional) onload - ( function(window) ) to be called when aURI is overlayed with aWith, expects a (object) window argument
//	(optional) onunload - ( function(window) ) to be called when aWith is unloaded from aURI, expects a (object) window argument
// unOverlayURI(aURI, aWith) - removes aWith overlay from aURI
//	see overlayURI()
// loaded(aURI, aWith) - returns (int) with corresponding overlay index in overlays[] if overlay aWith has been loaded for aURI, returns (bool) false otherwise 
//	see overlayURI()
this.overlayAid = {
	overlays: [],
	
	getPath: function(aPath) {
		return (aPath.indexOf("chrome://") === 0) ? aPath : "chrome://"+objPathString+"/content/"+aPath+".xul";
	},
	
	overlayURI: function(aURI, aWith, beforeload, onload, onunload) {
		var path = this.getPath(aWith);
		if(this.loaded(aURI, path) !== false) { return; }
		
		var newOverlay = {
			uri: aURI,
			overlay: path,
			beforeload: beforeload || null,
			onload: onload || null,
			onunload: onunload || null,
			document: null
			
		};
		var i = this.overlays.push(newOverlay) -1;
		
		xmlHttpRequest(path, function(xmlhttp) {
			if(xmlhttp.readyState === 4) {
				overlayAid.overlays[i].document = xmlhttp.responseXML;
				overlayAid.cleanXUL(overlayAid.overlays[i].document);
				windowMediator.callOnAll(overlayAid.scheduleWindow);
			}
		});
	},
	
	unOverlayURI: function(aURI, aWith) {
		// I sometimes call unOverlayURI() when unloading modules, but these functions are also called when shutting down the add-on, preventing me from unloading the overlays.
		// This makes it so it keeps the reference to the overlay when shutting down so it's properly removed in unloadAll().
		if(unloaded) { return; }
		
		var path = this.getPath(aWith);
		var i = this.loaded(aURI, path);
		if(i === false) { return; }
		
		this.overlays.splice(i, 1);
		
		windowMediator.callOnAll(function(window) {
			overlayAid.scheduleUnWindow(window, path);
		});
	},	
	
	cleanXUL: function(node) {
		// Replace objName with this objName in every attribute
		if(node.attributes) {
			for(var i = 0; i < node.attributes.length; i++) {
				while(node.attributes[i].value.indexOf('objName') > -1) {
					node.attributes[i].value = node.attributes[i].value.replace('objName', objName);
				}
				while(node.attributes[i].value.indexOf('objPathString') > -1) {
					node.attributes[i].value = node.attributes[i].value.replace('objPathString', objPathString);
				}
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
			
			this.cleanXUL(curChild);
			curChild = curChild.nextSibling;
		}
	},
	
	loaded: function(aURI, aWith) {
		var path = this.getPath(aWith);
		for(var i = 0; i < this.overlays.length; i++) {
			if(this.overlays[i].uri == aURI && this.overlays[i].overlay == path) {
				return i;
			}
		}
		return false;
	},
	
	scheduleWindow: function(window) {
		// On shutdown, this could cause errors since we do aSync's here and it wouldn't find the object after it's been removed.
		if(unloaded) { return; }
		
		if(window.document.readyState != 'complete') {
			windowMediator.callOnLoad(window, function() { 
				aSync(function() { overlayAid.overlayWindow(window); });
			});
		}
		else {
			aSync(function() { overlayAid.overlayWindow(window); });
		}
	},
	
	scheduleUnWindow: function(window, aWith) {
		// On shutdown, this could cause errors since we do aSync's here and it wouldn't find the object after it's been removed.
		if(unloaded) { return; }
		
		aSync(function() { overlayAid.unOverlayWindow(window, aWith); });
	},
	
	unloadAll: function(window) {
		if(window._OVERLAYS_LOADED) {
			for(var o = window._OVERLAYS_LOADED.length -1; o >= 0; o--) {
				var isFromHere = false;
				for(var i = 0; i < overlayAid.overlays[i].length; i++) {
					if(window._OVERLAYS_LOADED[o].uri == overlayAid.overlays[i].uri) {
						isFromHere = true;
						break;
					}
				}
				overlayAid.unOverlayWindow(window, window._OVERLAYS_LOADED[o].uri, true, isFromHere);
			}
			delete window._OVERLAYS_LOADED;
			delete window._BEING_OVERLAYED;
		}
	},
	
	windowHasOverlay: function(window, uri) {
		if(window._OVERLAYS_LOADED == undefined) {
			return false;
		}
		for(var i = 0; i < window._OVERLAYS_LOADED.length; i++) {
			if(window._OVERLAYS_LOADED[i].uri == uri) {
				return i;
			}
		}
		return false;
	},
	
	traceBack: function(window, traceback, unshift) {
		if(!unshift) {
			window._OVERLAYS_LOADED[window._BEING_OVERLAYED].traceBack.push(traceback);
		} else {
			window._OVERLAYS_LOADED[window._BEING_OVERLAYED].traceBack.unshift(traceback);
		}
	},
	
	updateOverlayedNodes: function(window, node, nodeList) {
		if(nodeList != undefined) {
			for(var k = 0; k < nodeList.length; k++) {
				window._OVERLAYS_LOADED[nodeList[k].i].traceBack[nodeList[k].j][nodeList[k].nodeField] = node;
			}
			return true;
		}
		
		nodeList = [];
		for(var i = 0; i < window._OVERLAYS_LOADED.length; i++) {
			for(var j = 0; j < window._OVERLAYS_LOADED[i].traceBack.length; j++) {
				if(window._OVERLAYS_LOADED[i].traceBack[j].node && window._OVERLAYS_LOADED[i].traceBack[j].node == node) {
					nodeList.push({ i: i, j: j, nodeField: 'node' });
				}
				else if(window._OVERLAYS_LOADED[i].traceBack[j].originalParent && window._OVERLAYS_LOADED[i].traceBack[j].originalParent == node) {
					nodeList.push({ i: i, j: j, nodeField: 'originalParent' });
				}
			}
		}
		return nodeList;
	},
	
	unOverlayWindow: function(window, aWith, dontSchedule, isFromHere) {
		if(!dontSchedule && window._BEING_OVERLAYED) {
			this.scheduleUnWindow(window, aWith);
			return;
		}
		window._BEING_OVERLAYED = true;
		
		if(!isFromHere) {
			isFromHere = false;
		}
		
		var i = this.windowHasOverlay(window, aWith);
		if(i !== false) {
			for(var j = window._OVERLAYS_LOADED.length -1; j > i; j--) {
				this.removeOverlay(window, j, !isFromHere);
			}
			
			this.removeOverlay(window, i);
			
			if(window._OVERLAYS_LOADED.length == 0) {
				delete window._OVERLAYS_LOADED;
			}
		}
		
		if(!dontSchedule) {
			delete window._BEING_OVERLAYED;
		}
		return;
	},
	
	removeOverlay: function(window, i, reschedule) {
		if(window._OVERLAYS_LOADED[i].onunload) {
			window._OVERLAYS_LOADED[i].onunload(window);
		}
		
		for(var j = window._OVERLAYS_LOADED[i].traceBack.length -1; j >= 0; j--) {
			var action = window._OVERLAYS_LOADED[i].traceBack[j];
			if(action.node) {
				var updateList = this.updateOverlayedNodes(window, action.node);
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
						if(action.node && action.node.parentNode && action.originalPos < action.node.parentNode.childNodes.length) {
							action.node = action.node.parentNode.insertBefore(action.node, action.node.parentNode.childNodes[action.originalPos]);
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
						if(action.node) {
							action.node.setAttribute(action.name, action.value);
						}
						break;
					
					case 'addAttribute':
						if(action.node) {
							action.node.removeAttribute(action.name);
						}
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
						window.sizeToContent();
						break;
						
					default: break;
				}
			} catch(ex) {}
			
			if(action.node) {
				this.updateOverlayedNodes(window, action.node, updateList);
			}
		}
		
		this.startPreferences(window);
		
		if(reschedule) {
			reschedule = window._OVERLAYS_LOADED[i].reschedule;
		}
		window._OVERLAYS_LOADED.splice(i, 1);
		if(reschedule) {
			reschedule();
		}
	},
	
	overlayWindow: function(window) {
		if(window._BEING_OVERLAYED) {
			this.scheduleWindow(window);
			return;
		}
		window._BEING_OVERLAYED = true;
		var rescheduleOverlay = false;
		
		for(var i = 0; i < this.overlays.length; i++) {
			if(this.overlays[i].document
			&& (this.overlays[i].uri == window.document.baseURI || this.windowHasOverlay(window, this.overlays[i].uri) !== false)
			&& this.windowHasOverlay(window, this.overlays[i].overlay) === false) {
				if(window._OVERLAYS_LOADED == undefined) {
					window._OVERLAYS_LOADED = [];
				}
				window._BEING_OVERLAYED = window._OVERLAYS_LOADED.push({
					uri: this.overlays[i].overlay,
					traceBack: [],
					onunload: this.overlays[i].onunload,
					reschedule: function() {
						overlayAid.scheduleWindow(window);
					}
				}) -1;
				
				if(this.overlays[i].beforeload) {
					this.overlays[i].beforeload(window);
				}
				
				for(var o = 0; o < this.overlays[i].document.childNodes.length; o++) {
					if(this.overlays[i].document.childNodes[o].nodeName == 'window') {
						continue;
					}
					
					if(this.overlays[i].document.childNodes[o].nodeName == 'overlay') {
						this.loadInto(window, this.overlays[i].document.childNodes[o]);
					}
					
					else if(this.overlays[i].document.childNodes[o].nodeName == 'xml-stylesheet') {
						this.appendXMLSS(window, this.overlays[i].document.childNodes[o]);
					}
				}
				
				// Have to set the correct values into modified preferences
				this.startPreferences(window);
				
				// Resize the preferences dialogs to fit the content
				this.sizeToContent(window);
				
				if(this.overlays[i].onload) {
					this.overlays[i].onload(window);
				}
				
				rescheduleOverlay = true;
			}
		}
		
		delete window._BEING_OVERLAYED;
		
		// Re-schedule overlaying the window to load overlays over newly loaded overlays if necessary
		if(rescheduleOverlay) {
			this.scheduleWindow(window);
		}
		
		return;
	},
	
	loadInto: function(window, overlay) {
		for(var i = 0; i < overlay.childNodes.length; i++) {
			var overlayNode = overlay.childNodes[i];
			
			// Special case for overlaying preferences to options dialogs
			if(overlayNode.nodeName == 'preferences') {
				this.addPreferences(window, overlay.childNodes[i]);
				continue;
			}
			
			// Overlaying script elements when direct children of the overlay element
			// With src attribute we import it as a subscript of window, otherwise we eval the inline content of the script tag
			if(overlayNode.nodeName == 'script' && overlay.nodeName == 'overlay') {
				if(overlayNode.hasAttribute('src')) {
					Services.scriptloader.loadSubScript(overlayNode.getAttribute('src'), window);
				} else {
					window.eval(overlayNode.textContent);
				}
				continue;
			}
			
			// No id means the node won't be processed
			if(!overlayNode.id) { continue; }
			
			var node = window.document.getElementById(overlayNode.id);
			// Handle if node with same id was found
			
			if(node) {
				// Don't process if id mismatches nodename; I should just make sure this doesn't happen in my overlays
				if(node.nodeName != overlayNode.nodeName) { continue; }
				
				// If removeelement attribute is true, remove the element and do nothing else
				if(overlayNode.getAttribute('removeelement') == 'true') {
					this.removeChild(window, node);
					continue;
				}
				
				// Copy attributes to node
				for(var a = 0; a < overlayNode.attributes.length; a++) {
					// Why bother, id is the same already
					if(overlayNode.attributes[a].name == 'id') { continue; }
					
					this.setAttribute(window, node, overlayNode.attributes[a]);
				}
				
				// Move the node around if necessary
				node = this.moveAround(window, node, overlayNode, node.parentNode);
				
				// Get Children of an Element's ID into this node
				this.getChildrenOf(window, node);
				
				// Load children of the overlayed node
				this.loadInto(window, overlay.childNodes[i]);
			}
			else if(overlayNode.parentNode.nodeName != 'overlay') {
				var node = window.document.importNode(overlayNode);
				
				// Add the node to the correct place
				node = this.moveAround(window, node, overlayNode, window.document.getElementById(overlayNode.parentNode.id));
				
				// Get Children of an Element's ID into this node
				this.getChildrenOf(window, node);
				
				// Surf through all the children of node for the getchildrenof attribute
				var allGetChildrenOf = node.getElementsByAttribute('getchildrenof', '*');
				for(var gco = 0; gco < allGetChildrenOf.length; gco++) {
					this.getChildrenOf(window, allGetChildrenOf[gco]);
				}
			}
		}
	},
	
	moveAround: function(window, node, overlayNode, parent) {
		if(overlayNode.getAttribute('insertafter')) {
			var idList = overlayNode.getAttribute('insertafter').split(',');
			for(var i = 0; i < idList.length; i++) {
				var id = trim(idList[i]);
				if(id == '') { continue; }
				if(id == node.id) { continue; } // this is just stupid of course...
				
				for(var c = 0; c < parent.childNodes; c++) {
					if(parent.childNodes[c].id == id) {
						return this.insertBefore(window, node, parent.childNodes[c].nextSibling);
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
				
				for(var c = 0; c < parent.childNodes; c++) {
					if(parent.childNodes[c].id == id) {
						return this.insertBefore(window, node, parent.childNodes[c]);
					}
				}
			}
		}
		
		if(overlayNode.getAttribute('position')) {
			var position = parseInt(overlayNode.getAttribute('position')) -1; // one-based children list
			var sibling = (sibling < parent.childNodes.length) ? node.parentNode.childNodes[position] : null;
			return this.insertBefore(window, node, sibling);
		}
		
		if(!node.parentNode) {
			return this.appendChild(window, node, parent);
		}
		return node;
	},
	
	getChildrenOf: function(window, node) {
		var getID = node.getAttribute('getchildrenof');
		if(!getID) { return; }
		
		getID = getID.split(',');
		for(var i = 0; i < getID.length; i++) {
			var getNode = window.document.getElementById(trim(getID[i]));
			if(!getNode) { continue; }
			
			var curChild = 0;
			while(curChild < getNode.childNodes.length) {
				if(getNode.childNodes[curChild].nodeName == 'preferences' || isAncestor(node, getNode.childNodes[curChild])) {
					curChild++;
					continue;
				}
				
				this.appendChild(window, getNode.childNodes[curChild], node);
			}
		}
	},
	
	appendChild: function(window, node, parent) {
		var originalParent = node.parentNode;
		var updateList = this.updateOverlayedNodes(window, node);
		
		try { node = parent.appendChild(node); } catch(ex) { node = null; }
		
		this.updateOverlayedNodes(window, node, updateList);
		this.traceBack(window, { action: 'appendChild', node: node, originalParent: originalParent });
		return node;
	},
	
	insertBefore: function(window, node, sibling) {
		if(node.parentNode) {
			for(var o = 0; o < node.parentNode.childNodes.length; o++) {
				if(node.parentNode.childNodes[o] == node) {
					break;
				}
			}
		}
		var updateList = this.updateOverlayedNodes(window, node);
		
		try { node = node.parentNode.insertBefore(node, sibling); } catch(ex) { node = null; }
		
		this.updateOverlayedNodes(window, node, updateList);
		if(!node.parentNode) {
			this.traceBack(window, { action: 'appendChild', node: node });
		} else {
			this.traceBack(window, { action: 'insertBefore', node: node, originalPos: o });
		}
		
		return node;
	},
	
	removeChild: function(window, node) {
		var updateList = this.updateOverlayedNodes(window, node);
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
		
		this.updateOverlayedNodes(window, node, updateList);
		this.traceBack(window, { action: 'removeChild', node: node, originalParent: originalParent, originalPos: o });
		return node;
	},
	
	setAttribute: function(window, node, attr) {
		if(node.hasAttribute(attr.name)) {
			this.traceBack(window, { action: 'modifyAttribute', node: node, name: attr.name, value: node.getAttribute(attr.name) });
		} else {
			this.traceBack(window, { action: 'addAttribute', node: node, name: attr.name });
		}
		
		try { node.setAttribute(attr.name, attr.value); } catch(ex) {}
	},
	
	appendXMLSS: function(window, node) {
		try { 
			node = window.document.importNode(node);
			// these have to come before the actual window element, here's hoping it's always the last one
			node = window.document.insertBefore(node, window.document.lastChild);
		} catch(ex) { node = null; }
		this.traceBack(window, { action: 'appendXMLSS', node: node });
		return node;
	},
	
	addPreferences: function(window, node) {
		var prefPane = window.document.getElementById(node.parentNode.id);
		if(!prefPane) { return; }
		
		var prefElements = prefPane.getElementsByTagName('preferences');
		if(prefElements.length == 0) {
			try {
				var prefs = window.document.importNode(node);
				prefs = prefPane.appendChild(prefs);
			} catch(ex) { prefs = null; }
			this.traceBack(window, { action: 'addPreferencesElement', prefs: prefs });
			return;
		}
		
		var prefs = prefElements[0];
		for(var p = 0; p < node.childNodes.length; p++) {
			if(!node.childNodes[p].id) { continue; }
			
			try {
				var pref = window.document.importNode(node.childNodes[p]);
				pref = prefs.appendChild(pref);
			} catch(ex) { pref = null; }
			this.traceBack(window, { action: 'addPreference', pref: pref });
		}
	},
	
	startPreferences: function(window) {
		var prefs = window.document.getElementsByTagName('preference');
		for(var i = 0; i < prefs.length; i++) {
			// Overlayed preferences have a null value, like they haven't been initialized for some reason, this takes care of that
			if(prefs[i].value === null) {
				prefs[i].value = prefs[i].valueFromPreferences;
			}
			try { prefs[i].updateElements(); } catch(ex) {}
		}
	},
	
	sizeToContent: function(window) {
		var isPrefDialog = window.document.getElementsByTagName('prefwindow');
		if(isPrefDialog.length > 0 && isPrefDialog[0].parentNode == window.document) {
			try { window.sizeToContent(); } catch(ex) {}
			this.traceBack(window, { action: 'sizeToContent' }, true);
		}
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

// setWatchers(obj, remove) - This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
//	obj - (xul element) to prepare the watchers on, every method is added to obj and acts upon it
//		obj.addPropertyWatcher(prop, handler, capture) - registers handler as a watcher for obj property prop changes
//			prop - (string) property name in obj to watch
//			handler - (function) method to fire when prop is set or changed
//			(optional) capture - when true it cancels setting the property if handler returns (bool) false, defaults to false
//		obj.removePropertyWatcher(prop, handler, capture) - unregisters handler as a watcher for prop changes
//			see obj.addPropertyWatcher()
//		obj.addAttributeWatcher(attr, handler, capture) - registers handler as a watcher for object attribute attr changes
//			attr - (string) attribute name of obj to watch
//			handler - (function) method to fire when attr is set, removed or changed
//			(optional) capture - when true it cancels setting the attribute if handler returns (bool) false, defaults to false
//		obj.removeAttributeWatcher(attr, handler, capture) - unregisters handler as a watcher for object attribute attr changes
//			see obj.addAttributeWatcher()
//	(optional) remove - if true it removes all the methods introduced by setWatchers, defaults to false
// All handlers expect function(prop, oldVal, newVal), where:
//	prop - (string) name of the property or attribute being set
//	oldVal - the current value of prop
//	newVal - the new value of prop
// Note: deleting a watched property does not trigger the watchers, so don't do it. Also setting the watchers on an unset property won't work either.
// I can't do anything when setting attributes from within the .attributes element property.
this.setWatchers = function(obj, remove) {
	if(typeof(obj) != 'object') { return; }
	
	if(remove) {
		if(!obj._propWatchers) { return; }
		
		for(var i = 0; i < obj._propWatchers.setters.length; i++) {
			if(obj._propWatchers.setters[i] == objName) { 
				obj._propWatchers.setters.splice(i, 1);
				break;
			}
		}
		if(obj._propWatchers.setters.length > 0) { return; }
		
		// remove accessors
		for(var prop in obj._propWatchers.properties) {
			delete obj[prop];
			obj[prop] = obj._propWatchers.properties[prop].value;
		}
		delete obj.addPropertyWatcher;
		delete obj.removePropertyWatcher;
		
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
		delete obj.addAttributeWatcher;
		delete obj.removeAttributeWatcher;
		
		delete obj._propWatchers;
		
		return;
	}
	
	if(!obj._propWatchers) {
		obj._propWatchers = {
			setters: [],
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
	}
	for(var i = 0; i < obj._propWatchers.setters.length; i++) {
		if(obj._propWatchers.setters[i] == objName) { return; }
	}
	obj._propWatchers.setters.push(objName);
	
	// Properties part, works by replacing the get and set accessor methods of a property with custom ones
	obj.addPropertyWatcher = function(prop, handler, capture) {
		if(typeof(this[prop]) == 'undefined') { return; }
		capture = (capture) ? true : false;
		
		if(typeof(this._propWatchers.properties[prop]) == 'undefined') {
			var tempVal = this[prop];
			// can't watch constants
			if(!(delete this[prop])) { return; }
			
			this._propWatchers.properties[prop] = {
				value: tempVal,
				handlers: []
			};
			this._propWatchers.properties[prop].handlers.push({ handler: handler, capture: capture });
			
			this.__defineGetter__(prop, function () { return this._propWatchers.properties[prop].value; });
			this.__defineSetter__(prop, function (newVal) {
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
			for(var i=0; i<this._propWatchers.properties[prop].handlers.length; i++) {
				if(compareFunction(this._propWatchers.properties[prop].handlers[i].handler, handler)
				&& capture == this._propWatchers.properties[prop].handlers[i].capture) { return; }
			}
			this._propWatchers.properties[prop].handlers.push({ handler: handler, capture: capture });
		}
	};
	
	obj.removePropertyWatcher = function(prop, handler, capture) {
		if(typeof(this._propWatchers.properties[prop]) == 'undefined') { return; }
		capture = (capture) ? true : false;
		
		for(var i=0; i<this._propWatchers.properties[prop].handlers.length; i++) {
			if(compareFunction(this._propWatchers.properties[prop].handlers[i].handler, handler)
			&& capture == this._propWatchers.properties[prop].handlers[i].capture) {
				this._propWatchers.properties[prop].handlers.splice(i, 1);
				break;
			}
		}
		
		if(this._propWatchers.properties[prop].handlers.length == 0) {
			delete this[prop]; // remove accessors
			this[prop] = this._propWatchers.properties[prop].value;
			delete this._propWatchers.properties[prop];
		}
	};
	
	// Attributes part, works by replacing the actual attribute native functions with custom ones (while still using the native ones)
	obj.addAttributeWatcher = function(attr, handler, capture) {
		capture = (capture) ? true : false;
		
		if(typeof(this._propWatchers.attributes[attr]) == 'undefined') {
			this._propWatchers.attributes[attr] = {
				value: (this.hasAttribute(attr)) ? this.getAttribute(attr) : null,
				handlers: []
			};
			this._propWatchers.attributes[attr].handlers.push({ handler: handler, capture: capture });
		}
		else {
			for(var i=0; i<this._propWatchers.attributes[attr].handlers.length; i++) {
				if(compareFunction(this._propWatchers.attributes[attr].handlers[i].handler, handler)
				&& capture == this._propWatchers.attributes[attr].handlers[i].capture) { return; }
			}
			this._propWatchers.attributes[attr].handlers.push({ handler: handler, capture: capture });
		}
	};
	
	obj.removeAttributeWatcher = function (attr, handler, capture) {
		if(typeof(this._propWatchers.attributes[attr]) == 'undefined') { return; }
		capture = (capture) ? true : false;
		
		for(var i=0; i<this._propWatchers.attributes[attr].handlers.length; i++) {
			if(compareFunction(this._propWatchers.attributes[attr].handlers[i].handler, handler)
			&& capture == this._propWatchers.attributes[attr].handlers[i].capture) {
				this._propWatchers.attributes[attr].handlers.splice(i, 1);
				break;
			}
		}
		
		if(this._propWatchers.attributes[attr].handlers.length == 0) {
			delete this._propWatchers.attributes[attr];
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
	if(!show) {
		aNode.setAttribute('collapsed', 'true');
	} else {
		aNode.removeAttribute('collapsed');
	}
};

// trim(str) - trims whitespaces from a string (found in http://blog.stevenlevithan.com/archives/faster-trim-javascript -> trim3())
//	str - (string) to trim
this.trim = function(str) {
	if(typeof(str) != 'string') {
		return '';
	}
	
	return str.substring(Math.max(str.search(/\S/), 0), str.search(/\S\s*$/) + 1);
};

moduleAid.LOADMODULE = function() {
	// This is so the observers aren't called twice on quitting sometimes
	observerAid.add(function() { observerAid.hasQuit = true; }, 'quit-application');
	Services.ww.registerNotification(windowMediator.callWatchers);
	windowMediator.register(overlayAid.scheduleWindow, 'domwindowopened');
};

moduleAid.UNLOADMODULE = function() {
	observerAid.clean();
	windowMediator.callOnAll(overlayAid.unloadAll);
	Services.ww.unregisterNotification(windowMediator.callWatchers);
	prefAid.clean();
	moduleAid.clean();
};
