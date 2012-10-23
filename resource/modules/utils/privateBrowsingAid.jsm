moduleAid.VERSION = '2.0.1';
moduleAid.LAZY = true;

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
				try {
					if(aTopic == "private-browsing") {
						if(aData == "enter" && this.onEnter) {
							this.onEnter();
						} else if(aData == "exit" && this.onExit) {
							this.onExit();
						}
					} else if(aTopic == "quit-application" && this.onQuit) {
						this.onQuit();
					}
				}
				// write errors in the console only after it has been cleared
				catch(ex) { aSync(function() { Cu.reportError(ex); }); }
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
			try { watcher.autoStarted(); }
			catch(ex) { aSync(function() { Cu.reportError(ex); }); }
		}
	},
	
	removeWatcher: function(aWatcher) {
		var watcher = this.prepare(aWatcher);
		
		observerAid.remove(watcher, "private-browsing");
		observerAid.remove(watcher, "quit-application");
	}
};
