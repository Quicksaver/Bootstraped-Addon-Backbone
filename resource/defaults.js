/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
