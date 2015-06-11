This is the backbone I use for all my add-ons. It ensures that they are 100% compatible with each other, simplifying the feature implementations by the add-ons. If you wish to use it yourself, you can do so, but make sure you keep it updated to ensure its proper functioning for new versions of firefox or of other add-ons that use it.

All the files have instructions on how to use their objects at the top of the file. I suggest you start with bootstrap.js which has some general first-build information, and if you have any questions or problems you can always ask me of course.

Some initial steps need to be followed to make an initial build;

1) fill out all the empty fields in install.rdf;

2) change the appropriate strings in these files:

- {objName} and {objPathString}
-- chrome/content/utils/about.xul
-- chrome/content/utils/preferences.xul
-- resource/defaultsContent.js

- objPathString
-- chrome.manifest
-- chrome/skin/common/defaults.css

- path-to-logo-image
-- chrome/skin/common/defaults.css

3) add proper localization strings in the following files:

- chrome/locale/en-US/defaults.dtd
-- preferences.title - title of the add-on's preferences tab
-- about.name - add-on's name
-- about.signature - developer signature, either name or alias or something like it

- chrome/locale/en-US/utils/about.dtd
-- about.tryit - Catchy line for sharing the add-on in social networks

4) fill changelog.json in the appropriate format, otherwise delete the file and it won't be used.
.. Everything after and inclusive of a "//" is to be removed! It is just there to exemplify the object organization, JSON doesn't have comments in its syntax!

5) start coding from defaults.js, fill its necessary variables accordingly (see bootstrap.js for their definition and for what methods it expects)
