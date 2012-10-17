moduleAid.VERSION = '2.0.0';
moduleAid.LAZY = true;
moduleAid.VARSLIST = ['Globals', 'window', 'document', 'prefAid', 'styleAid', 'windowMediator', 'observerAid', 'privateBrowsingAid', 'overlayAid', 'stringsAid', 'objectWatcher', 'xmlHttpRequest', 'aSync', 'dispatch', 'compareFunction', 'isAncestor', 'hideIt', 'trim', 'closeCustomize', 'setAttribute', 'removeAttribute', 'toggleAttribute'];

// Globals - lets me use objects that I can share through all the windows
this.Globals = {};

// window - Similarly to windowMediator.callOnMostRecent, the window property returns the most recent navigator:browser window object
this.__defineGetter__('window', function() { return Services.wm.getMostRecentWindow('navigator:browser'); });

// document - Returns the document object associated with the most recent window object
this.__defineGetter__('document', function() { return window.document; });

/* I can't seem to define any kind of lazy getters like:
	this.__defineGetter__('something', function() { return moduleAid.load('utils/something') ? something : null; });
or
	this.something = function(a, b) { return moduleAid.load('utils/something') ? aSync(a, b) : null; };
It throws me 'too much recursion' errors all over. So I'm just loading them all at once. */

moduleAid.LOADMODULE = function() {
	moduleAid.load('utils/prefAid');
	moduleAid.load('utils/styleAid');
	moduleAid.load('utils/windowMediator');
	moduleAid.load('utils/observerAid');
	moduleAid.load('utils/privateBrowsingAid');
	moduleAid.load('utils/overlayAid');
	moduleAid.load('utils/stringsAid');
	moduleAid.load('utils/objectWatcher');
	moduleAid.load('utils/sandboxTools');
	moduleAid.load('utils/attributes');
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.clean();
};
