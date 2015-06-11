// VERSION 1.0.0

Services.scriptloader.loadSubScript("resource://{objPathString}/modules/utils/content.js", this);

this.{objName} = this.__contentEnvironment;
delete this.__contentEnvironment;

this.{objName}.objName = '{objName}';
this.{objName}.objPathString = '{objPathString}';
this.{objName}.init();
