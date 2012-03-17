// This looks for file defaults.js in resource folder, expects:
//	objName - (string) main object name for the add-on, to be added to window element
//	objPathString - (string) add-on path name to use in URIs
//	prefList: (object) { prefName: defaultValue } - add-on preferences
//	startConditions(aData, aReason) - (method) should return false if any requirements the add-on needs aren't met, otherwise return true or call continueStartup(aData, aReason)
//	onStartup(aData, aReason) and onShutdown(aData, aReason) - (methods) to be called on startup() and shutdown() to initialize and terminate the add-on respectively
//	resource folder in installpath, with modules folder containing moduleAid, sandboxUtils and utils modules
//	chrome.manifest file with content, locale and skin declarations properly set
// prepareObject(window, aName) - initializes a window-dependent add-on object with utils loaded into it, returns the newly created object
//	window - (xul object) the window object to be initialized
//	(optional) aName - (string) the object name, defaults to objName
// removeObject(window, aName) - closes and removes the object initialized by prepareObject()
//	see prepareObject()
// preparePreferences(window, aName) - loads the preferencesUtils module into that window's object initialized by prepareObject() (if it hasn't yet, it will be initialized)
//	see prepareObject()
// disable() - disables the add-on

let bootstrapVersion = '1.0.1';
let unloaded = false;
let started = false;
let addonData = null;

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyServiceGetter(Services, "fuel", "@mozilla.org/fuel/application;1", "fuelIApplication");
XPCOMUtils.defineLazyServiceGetter(Services, "privateBrowsing", "@mozilla.org/privatebrowsing;1", "nsIPrivateBrowsingService");
XPCOMUtils.defineLazyServiceGetter(Services, "stylesheet", "@mozilla.org/content/style-sheet-service;1", "nsIStyleSheetService");

function prepareObject(window, aName) {
	// I can override the object name if I want
	let objectName = aName || objName;
	if(window[objectName]) { return; }
	
	window[objectName] = {
		objName: objectName,
		objPathString: objPathString,
		
		// every supposedly global variable is inaccessible because bootstraped means sandboxed, so I have to reference all these;
		// it's easier to reference more specific objects from within the modules for better control, only setting these two here because they're more generalized
		window: window,
		get document () { return window.document; }
	};
	
	Services.scriptloader.loadSubScript("resource://"+objPathString+"/modules/moduleAid.jsm", window[objectName]);
	window[objectName].moduleAid.load("utils");
}

function removeObject(window, aName) {
	let objectName = aName || objName;
	
	if(window[objectName]) {
		window[objectName].moduleAid.unload("utils");
		delete window[objectName];
	}
}

function preparePreferences(window, aName) {
	let objectName = aName || objName;
	
	if(!window[objectName]) {
		prepareObject(window, objectName);
	}
	window[objectName].moduleAid.load("preferencesUtils");
}

function setDefaults() {
	if(prefList) {
		prefAid.setDefaults(prefList);
	}
}

function setResourceHandler() {
	let alias = Services.io.newFileURI(addonData.installPath);
	let resourceURI = (addonData.installPath.isDirectory()) ? alias.spec : 'jar:' + alias.spec + '!/';
	resourceURI += 'resource/';
	
	// Set the default strings for the add-on
	Services.scriptloader.loadSubScript(resourceURI + 'defaults.js', this);
	
	alias = Services.io.newURI(resourceURI, null, null);
	let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
	resource.setSubstitution(objPathString, alias);
	
	// Get the utils.jsm module into our sandbox
	Services.scriptloader.loadSubScript("resource://"+objPathString+"/modules/moduleAid.jsm", this);
	moduleAid.load("sandboxUtils");
}

function removeResourceHandler() {
	moduleAid.unload("sandboxUtils");
	
	let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
	resource.setSubstitution(objPathString, null);
}

function disable() {
	AddonManager.getAddonByID(addonData.id, function(addon) {
		addon.userDisabled = true;
	});
}

function continueStartup(aReason) {
	started = aReason;
	
	// set add-on preferences defaults
	setDefaults();
	
	onStartup(aReason);
}

function startup(aData, aReason) {
	unloaded = false;
	addonData = aData;
	
	// add resource:// protocol handler so I can access my modules
	setResourceHandler();
	
	// In the case of OmnibarPlus, I need the Omnibar add-on enabled for everything to work
	if(startConditions(aReason)) {
		continueStartup(aReason);
	}
}

function shutdown(aData, aReason) {
	unloaded = aReason;
	observerAid.callQuits();
	
	if(aReason == APP_SHUTDOWN) { return; }
	
	if(started) {
		onShutdown(aReason);
	}
	
	// remove resource://
	removeResourceHandler();
}

function install() {}
function uninstall() {}
