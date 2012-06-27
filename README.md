# AROW

A RestfulObjects Workspace.

AROW is a single-page javascript frontend to the [RestfulObjects](http://restfulobjects.org/) spec.
It presents repository services in a menu at the top of the screen. Domain objects, lists, collections, and the rest are in individual draggable dialogs.

## Usage
If you are using [Apache Isis](http://incubator.apache.org/isis/) with the quickstart-archetype:
* Copy arow/ and arow.html to the src/main/webapp folder of your webapp module.
* Launch the web server
* Access AROW at http://localhost:8080/arow.html

You can also see a demo running at: http://simple-dusk-6870.herokuapp.com/arow.html

Login as sven/pass and click the Projects > All Projects link to start.

## Caveats
* AROW has only been tested against the Apache Isis json-viewer implementing v0.52 of the RO spec.
* And only on a few models.
* And not everything works.

## Roadmap
* Drag and drop support
* Choices for ObjectActions

## Thanks
Special thanks to Dan Haywood for his help on the isis mailing lists and to Johan Andries for his work on [restfulobjects-js](http://code.google.com/p/restfulobjects-js/).

## License
Copyright (C) 2012 Adam Howard

Distributed under the MIT License.