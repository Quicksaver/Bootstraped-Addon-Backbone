moduleAid.VERSION = '2.0.1';
moduleAid.LAZY = true;
moduleAid.VARSLIST = ['listenerAid', 'timerAid', 'modifyFunction', 'aSync', 'loadWindowTools'];

// listenerAid - Object to aid in setting and removing all kinds of event listeners to an object;
this.__defineGetter__('listenerAid', function() { delete this.listenerAid; moduleAid.load('utils/listenerAid'); return listenerAid; });

// timerAid - Object to aid in setting, initializing and cancelling timers
this.__defineGetter__('timerAid', function() { delete this.timerAid; moduleAid.load('utils/timerAid'); return timerAid; });

// modifyFunction() - allows me to modify a function quickly from within my scripts
this.modifyFunction = function(aOriginal, aArray) { loadWindowTools(); return modifyFunction(aOriginal, aArray); };

// aSync() - lets me run aFunc asynchronously, basically it's a one shot timer with a delay of aDelay msec
this.aSync = function(aFunc, aDelay) { loadWindowTools(); return aSync(aFunc, aDelay); };

this.loadWindowTools = function() {
	delete this.xmlHttpRequest;
	delete this.aSync;
	moduleAid.load('utils/windowTools');
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, 'unload', function(e) {
		removeObject(window, objName);
	}, false, true);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.clean(); // I'm leaving this one here because there's a call to it in the load function and because why not
	moduleAid.clean();
};
