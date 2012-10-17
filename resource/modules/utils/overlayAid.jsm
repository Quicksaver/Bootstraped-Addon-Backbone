moduleAid.VERSION = '2.0.0';
moduleAid.LAZY = true;

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
			persist: {}
			
		};
		var i = this.overlays.push(newOverlay) -1;
		
		xmlHttpRequest(path, function(xmlhttp) {
			if(xmlhttp.readyState === 4) {
				overlayAid.overlays[i].document = xmlhttp.responseXML;
				overlayAid.cleanXUL(overlayAid.overlays[i].document, overlayAid.overlays[i]);
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
			persist: {}
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
		if(node.attributes) {
			for(var a = 0; a < node.attributes.length; a++) {
				// Replace objName with this objName in every attribute
				while(node.attributes[a].value.indexOf('objName') > -1) {
					node.attributes[a].value = node.attributes[a].value.replace('objName', objName);
				}
				while(node.attributes[a].value.indexOf('objPathString') > -1) {
					node.attributes[a].value = node.attributes[a].value.replace('objPathString', objPathString);
				}
				
				if(node.attributes[a].name == 'persist' && node.id) {
					var persists = node.attributes[a].value.split(' ');
					overlay.persist[node.id] = {};
					for(var p=0; p<persists.length; p++) {
						overlay.persist[node.id][persists[p]] = true;
					}
				}
			}
		}
		
		if(node.nodeName == 'toolbar' && node.id) {
			if(!overlay.persist[node.id]) {
				overlay.persist[node.id] = {};
			}
			overlay.persist[node.id]['currentset'] = true;
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
			for(var x in overlay.persist) {
				return true;
			}
			return true;
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
						if(allRes[uri][id][attr] == '__empty') {
							setAttribute(node, attr, '');
						} else {
							toggleAttribute(node, attr, allRes[uri][id][attr], allRes[uri][id][attr]);
						}
						
						if(attr == 'currentset'
						&& allRes[uri][id][attr]
						&& allRes[uri][id][attr] != '__empty'
						&& node.nodeName == 'toolbar'
						&& node.getAttribute('customizable') == 'true'
						&& node.getAttribute('toolboxid')
						&& aWindow.document.getElementById(node.getAttribute('toolboxid'))) {
							aWindow.document.persist(id, 'currentset');
							
							var palette = aWindow.document.getElementById(node.getAttribute('toolboxid')).palette;
							if(!palette) { continue; }
							closeCustomize();
							
							var currentset = node.getAttribute('currentset').split(',');
							currentset_loop: for(var c=0; c<currentset.length; c++) {
								if(currentset[c] == 'separator' || currentset[c] == 'spring' || currentset[c] == 'spacer') {
									var newNode = aWindow.document.createElement('toolbar'+currentset[c]);
									var newNodeID = new Date().getTime();
									while(aWindow.document.getElementById(currentset[c]+newNodeID)) {
										newNodeID++;
									}
									newNode.id = currentset[c]+newNodeID;
									newNode.setAttribute('removable', 'true');
									if(currentset[c] == 'spring') {
										newNode.setAttribute('flex', '1');
									}
									node.appendChild(newNode);
									continue;
								}
								
								var button = palette.firstChild;
								while(button) {
									if(button.id == currentset[c]) {
										var addButton = button;
										var updateListButton = this.updateOverlayedNodes(aWindow, addButton);
										button = button.nextSibling;
										node.insertItem(addButton.id);
										this.updateOverlayedNodes(aWindow, addButton, updateListButton);
										continue currentset_loop;
									}
									button = button.nextSibling;
								}
							}
							
							this.traceBack(aWindow, { action: 'insertToolbar', node: node, palette: palette });
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
					
					case 'insertToolbar':
						closeCustomize();
						
						if(action.node && action.palette) {
							var button = action.node.firstChild;
							while(button) {
								if(button.nodeName == 'toolbarbutton') {
									var addedButton = button;
									button = button.nextSibling;
									var updateListButton = this.updateOverlayedNodes(aWindow, addedButton);
									addedButton = action.palette.appendChild(addedButton);
									this.updateOverlayedNodes(aWindow, addedButton, updateListButton);
									continue;
								}
								button = button.nextSibling;
							}
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
						var shift = 0;
						for(var i=e+1; i<currentset.length; i++) {
							if(currentset[i] == 'separator' || currentset[i] == 'spring' || currentset[i] == 'spacer') {
								shift++;
								continue;
							}
							
							var beforeEl = aWindow.document.getElementById(currentset[i]);
							if(beforeEl) {
								while(shift > 0 && beforeEl.previousSibling) {
									if(beforeEl.previousSibling != 'separator'
									&& beforeEl.previousSibling != 'spring'
									&& beforeEl.previousSibling != 'spacer') {
										break;
									}
									beforeEl = beforeEl.previousSibling;
									shift--;
								}
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
	}	
};

moduleAid.LOADMODULE = function() {
	windowMediator.register(overlayAid.scheduleAll, 'domwindowopened');
};

moduleAid.UNLOADMODULE = function() {
	windowMediator.callOnAll(overlayAid.unloadAll);
};
