// Many times I can't use 'this' to refer to the owning var's context, so I'm setting 'this' as 'self', 
// I can use 'self' from within functions, timers and listeners easily and to bind those functions to it as well
this.self = this;

// moduleAid - Helper to load subscripts into the context of "this"
// load(aModule, delayed) - loads aModule onto the context of self
//	aModule - (string) can be either module name which loads resource://objPathString/modules/aModule.jsm or full module path
//	(optional) delayed - true loads module 500ms later in an asychronous process, false loads immediatelly synchronously, defaults to false
// unload(aModule) - unloads aModule from the context of self
//	see load()
// loadIf(aModule, anIf, delayed) - conditionally load or unload aModule
//	anIf - true calls load(aModule, delayed), false calls unload(aModule)
//	see load()
// loaded(aModule) - returns (int) with corresponding module index in modules[] if aModule has been loaded, returns (bool) false otherwise
//	see load()
// subscript modules are run in the context of self, all objects should be set using this.whateverObject so they can be deleted on unload, moduleAid optionally expects these:
//	moduleAid.VERSION - (string) module version
//	moduleAid.VARSLIST - (array) list with all the objects the module inserts into the object when loaded, for easy unloading
//	moduleAid.LOADMODULE - (function) to be executed on module loading
//	moduleAid.UNLOADMODULE - (function) to be executed on module unloading
this.moduleAid = {
	version: '2.0.1',
	modules: [],
	moduleVars: {},
	
	loadIf: function(aModule, anIf, delayed) {
		if(anIf) {
			this.load(aModule, delayed);
		} else {
			this.unload(aModule);
		}
	},
	
	load: function(aModule, delayed) {
		var path = this.preparePath(aModule);
		if(this.loaded(path) != false) {
			return false;
		}
		
		Services.scriptloader.loadSubScript(path, self);
		
		var module = {
			name: aModule,
			path: path,
			load: (this.LOADMODULE) ? this.LOADMODULE : null,
			unload: (this.UNLOADMODULE) ? this.UNLOADMODULE : null,
			vars: (this.VARSLIST) ? this.VARSLIST : null,
			version: (this.VERSION) ? this.VERSION : null,
			loaded: false
		};
		var moduleIndex = this.modules.push(module) -1;
		
		if(this.VARSLIST) {
			this.createVars(this.VARSLIST);
		}
		if(this.LOADMODULE) {
			if(!delayed) {
				this.LOADMODULE();
				this.modules[moduleIndex].loaded = true;
			} else {
				aSync(function() {
					moduleAid.modules[moduleIndex].load.call(self);
					moduleAid.modules[moduleIndex].loaded = true; 
				}, 500);
			}
		}
		else {
			this.modules[moduleIndex].loaded = true;
		}
		
		delete this.VARSLIST;
		delete this.LOADMODULE;
		delete this.UNLOADMODULE;
		delete this.VERSION;
		return true;
	},
	
	unload: function(aModule) {
		var path = this.preparePath(aModule);
		
		var i = this.loaded(aModule);
		if(i !== false) {
			if(this.modules[i].unload && this.modules[i].loaded) {
				this.modules[i].unload();
			}
			if(this.modules[i].vars) {
				for(var o = 0; o < this.modules[i].vars.length; o++) {
					this.deleteVar(this.modules[i].vars[o]);
				}
			}
			this.modules.splice(i, 1);
			return true;
		}
		
		return false;
	},
	
	clean: function() {
		while(moduleAid.modules.length > 1) {
			moduleAid.unload(moduleAid.modules[1].name);
		}
	},
	
	loaded: function(aModule) {
		for(var i = 0; i < this.modules.length; i++) {
			if(this.modules[i].path == aModule || this.modules[i].name == aModule) {
				return i;
			}
		}
		return false;
	},
	
	createVars: function(aList) {
		for(var i=0; i<aList.length; i++) {
			if(this.moduleVars[aList[i]]) {
				this.moduleVars[aList[i]]++;
			} else {
				this.moduleVars[aList[i]] = 1;
			}
		}
	},
	
	deleteVar: function(aVar) {
		if(this.moduleVars[aVar]) {
			this.moduleVars[aVar]--;
			if(this.moduleVars[aVar] == 0) {
				delete self[aVar];
				delete this.moduleVars[aVar];
			}
			return true;
		}
		return false;
	},
	
	preparePath: function(aModule) {
		if(aModule.indexOf("resource://") === 0) {
			return aModule;
		}
		return "resource://"+objPathString+"/modules/"+aModule+".jsm";
	}
};
