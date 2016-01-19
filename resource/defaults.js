// VERSION 1.4

objName = '';
objPathString = '';
addonUUID = '';

addonUris = {
	homepage: '',
	support: '',
	fullchangelog: '',
	email: '',
	profile: '',
	api: '',
	development: ''
};

prefList = {};

// If we're initializing in a content process, we don't care about the rest
if(isContent) { throw 'isContent'; }

paneList = [];
