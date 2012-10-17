moduleAid.VERSION = '2.0.0';
moduleAid.LAZY = true;
moduleAid.VARSLIST = ['listenerAid', 'timerAid', 'modifyFunction', 'aSync'];

/* I can't seem to define any kind of lazy getters like:
	this.__defineGetter__('something', function() { return moduleAid.load('utils/something') ? something : null; });
or
	this.something = function(a, b) { return moduleAid.load('utils/something') ? aSync(a, b) : null; };
It throws me 'too much recursion' errors all over. So I'm just loading them all at once. */

moduleAid.LOADMODULE = function() {
	moduleAid.load('utils/listenerAid');
	moduleAid.load('utils/timerAid');
	moduleAid.load('utils/windowTools');
	
	listenerAid.add(window, 'unload', function(e) {
		removeObject(window, objName);
	}, false, true);
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.clean();
};
