moduleAid.VERSION = '1.1.5';
moduleAid.VARSLIST = ['modifyFunction', 'listenerAid', 'aSync', 'timerAid'];

// modifyFunction(aOriginal, aArray) - allows me to modify a function quickly from within my scripts
//	aOriginal - (function) function to be modified
//	aArray - (array) [ [original, new] x n ], where new replaces original in the modified function
// Note to self, by using the Function() method to create functions I'm priving them from their original context,
// that is, while inside a function created by that method in a module loaded by moduleAid I can't call 'subObj' (as in 'mainObj.subObj') by itself as I normally do,
// I have to either use 'mainObj.subObj' or 'this.subObj'; I try to avoid this as that is how I'm building my modularized add-ons, 
// so I'm using eval, at least for now until I find a better way to implement this functionality.
// Don't forget that in bootstraped add-ons, these modified functions take the context of the modifier (sandboxed).
this.modifyFunction = function(aOriginal, aArray) {
	var newCode = aOriginal.toString();
	for(var i=0; i < aArray.length; i++) {
		newCode = newCode.replace(aArray[i][0], aArray[i][1].replace("{([objName])}", objName));
	}
	
	try {
		eval('var ret = ' + newCode + ';');
		return ret;
	}
	catch(ex) {
		Cu.reportError(ex);
		return null;
	}
};

// listenerAid - Object to aid in setting and removing all kinds of event listeners to an object;
// add(obj, type, aListener, capture, maxTriggers) - attaches aListener to obj
//	obj - (object) to attach the listener to
//	type - (string) event type to listen for
//	aListener - (function) method to be called when event is dispatched, by default this will be bound to self
//	(optional) capture - (bool) true or false, defaults to false
//	(optional) maxTriggers -
//		(int) maximum number of times to fire aListener,
//		(bool) true is equivalent to (int) 1,
//		(bool) false aListener is not bound to self,
//		defaults to undefined
// remove(obj, type, aListener, capture, maxTriggers) - removes aListener from obj
//	see add()
this.listenerAid = {
	handlers: [],
	
	// if maxTriggers is set to the boolean false, it acts as a switch to not bind the function to our object
	// but if it's set to anything else it will bind the function,
	// thus I can't have an unbound function with maxTriggers
	add: function(obj, type, aListener, capture, maxTriggers) {
		if(!obj || !obj.addEventListener) { return false; }
		
		var unboundListener = this.modifyListener(aListener, maxTriggers, true);
		var listener = this.modifyListener(aListener, maxTriggers);
		
		if(this.listening(obj, type, capture, unboundListener) !== false) {
			return true;
		}
		
		if(maxTriggers === true) {
			maxTriggers = 1;
		}
		
		var newHandler = {
			obj: obj,
			type: type,
			unboundListener: unboundListener,
			listener: listener,
			capture: capture,
			maxTriggers: (maxTriggers) ? maxTriggers : null,
			triggerCount: (maxTriggers) ? 0 : null
		};
		this.handlers.push(newHandler);
		var i = this.handlers.length -1;
		
		this.handlers[i].obj.addEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
		return true;
	},
	
	remove: function(obj, type, aListener, capture, maxTriggers) {
		if(!obj || !obj.removeEventListener) { return false; }
		
		var unboundListener = this.modifyListener(aListener, maxTriggers, true);
			
		var i = this.listening(obj, type, capture, unboundListener);
		if(i !== false) {
			this.handlers[i].obj.removeEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
			this.handlers.splice(i, 1);
			return true;
		}
		return false;
	},
	
	listening: function(obj, type, capture, unboundListener) {
		for(var i=0; i<this.handlers.length; i++) {
			if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.handlers[i].capture == capture && compareFunction(this.handlers[i].unboundListener, unboundListener)) {
				return i;
			}
		}
		return false;
	},
	
	clean: function() {
		var i = 0;
		while(i < this.handlers.length) {
			if(this.handlers[i].obj && this.handlers[i].obj.removeEventListener) {
				this.handlers[i].obj.removeEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
			}
			this.handlers.splice(i, 1);
		}
		return true;
	},
	
	compareListener: function(a, b) {
		if(a == b || a.toSource() == b.toSource()) {
			return true;
		}
		return false;
	},
	
	modifyListener: function(listener, maxTriggers, forceUnbound) {
		var newListener = listener;
		
		if(maxTriggers) {
			newListener = modifyFunction(listener, [
				['{',
				<![CDATA[
				{
					// This still happens sometimes and I can't figure out why, it's mainly when I turn off the add-on, so it should be irrelevant
					if(this.listenerAid) {
						var targets = ['target', 'originalTarget', 'currentTarget'];
						
						mainRemoveListenerLoop:
						for(var a = 0; a < targets.length; a++) {
							for(var i = 0; i < this.listenerAid.handlers.length; i++) {
								if(this.listenerAid.handlers[i].obj == arguments[0][targets[a]]
								&& this.listenerAid.handlers[i].type == arguments[0].type
									&& ((this.listenerAid.handlers[i].capture && arguments[0].eventPhase == arguments[0].CAPTURING_PHASE)
									|| (!this.listenerAid.handlers[i].capture && arguments[0].eventPhase != arguments[0].CAPTURING_PHASE))
								&& this.listenerAid.compareListener(this.listenerAid.handlers[i].unboundListener, arguments.callee)) {
									this.listenerAid.handlers[i].triggerCount++;
									if(this.listenerAid.handlers[i].triggerCount == this.listenerAid.handlers[i].maxTriggers) {
										this.listenerAid.remove(arguments[0][targets[a]], this.listenerAid.handlers[i].type, this.listenerAid.handlers[i].unboundListener, this.listenerAid.handlers[i].capture);
										break mainRemoveListenerLoop;
									}
								}
							}
						}
					}
				]]>
				],
				
				// This is just so my editor correctly assumes the pairs of {}, it has nothing to do with the add-on itself
				['}',
				<![CDATA[
				}
				]]>
				]
			]);
		}
		
		if(maxTriggers !== false && !forceUnbound) {
			newListener = newListener.bind(self);
		}
		return newListener;
	}
};

// aSync(aFunc, aDelay) - lets me run aFunc asynchronously, basically it's a one shot timer with a delay of aDelay msec
//	aFunc - (function) to be called asynchronously
//	(optional) aDelay - (int) msec to set the timer, defaults to 0msec
this.aSync = function(aFunc, aDelay) {
	return timerAid.create(aFunc, (!aDelay) ? 0 : aDelay);
}

// timerAid - Object to aid in setting, initializing and cancelling timers
// init(aName, aFunc, aDelay, aType) - initializes a named timer to be kept in the timers object
//	aName - (string) to name the timer
//	aFunc - (function) to be fired by the timer, it will be bound to self
//	aDelay - (int) msec to set the timer
//	(optional) aType -
//		(string) 'slack' fires every aDelay msec and waits for the last aFunc call to finish before restarting the timer,
//		(string) 'precise' fires every aDelay msec,
//		(string) 'precise_skip' not really sure what this one does,
//		(string) 'once' fires only once,
//		defaults to once
this.timerAid = {
	timers: {},
	
	init: function(aName, aFunc, aDelay, aType) {
		this.cancel(aName);
		
		var type = this._switchType(aType);
		this.timers[aName] = {
			timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
			handler: aFunc
		};
		this.timers[aName].timer.init(function(aSubject, aTopic, aData) {
			timerAid.timers[aName].handler.call(self, aSubject, aTopic, aData);
			if(typeof(timerAid) != 'undefined' && aSubject.type == Ci.nsITimer.TYPE_ONE_SHOT) {
				timerAid.cancel(aName);
			}
		}, aDelay, type);
		
		this.__defineGetter__(aName, function() { return this.timers[aName]; });
		return this.timers[aName];
	},
	
	cancel: function(name) {
		if(this.timers[name]) {
			this.timers[name].timer.cancel();
			delete this.timers[name];
			delete this[name];
			return true;
		}
		return false;
	},
	
	clean: function() {
		for(var timerObj in this.timers) {
			this.cancel(timerObj);
		}
	},
	
	create: function(aFunc, aDelay, aType) {
		var type = this._switchType(aType);
		var newTimer = {
			timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
			handler: aFunc.bind(self),
			cancel: function() {
				this.timer.cancel();
			}
		};
		newTimer.timer.init(newTimer.handler, aDelay, type);
		return newTimer;
	},
			
	_switchType: function(type) {
		switch(type) {
			case 'slack':
				return Ci.nsITimer.TYPE_REPEATING_SLACK;
				break;
			case 'precise':
				return Ci.nsITimer.TYPE_REPEATING_PRECISE;
				break;
			case 'precise_skip':
				return Ci.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP;
				break;
			case 'once':
			default:
				return Ci.nsITimer.TYPE_ONE_SHOT;
				break;
		}
		
		return false;
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, 'unload', function(e) {
		removeObject(window, objName);
	}, false, true);
};

moduleAid.UNLOADMODULE = function() {
	timerAid.clean();
	listenerAid.clean();
	moduleAid.clean();
};
