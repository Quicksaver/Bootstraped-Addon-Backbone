moduleAid.VERSION = '2.0.0';
moduleAid.LAZY = true;

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

moduleAid.LOADMODULE = function() {
	Services.ww.registerNotification(windowMediator.callWatchers);
};

moduleAid.UNLOADMODULE = function() {
	Services.ww.unregisterNotification(windowMediator.callWatchers);
};
