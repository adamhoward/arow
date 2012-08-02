# AROW

A RestfulObjects Workspace.

AROW is a single-page javascript frontend to the [RestfulObjects](http://restfulobjects.org/) spec.
It presents repository services in a menu at the top of the screen. Domain objects, lists, collections, and the rest are in individual draggable dialogs.

AROW is now built on top of a little library I'm calling RO.Client for now. So it used to be that AROW spoke directly to the RestfulObjects server and operated on the JSON. This became unmanageable when trying to support both the separate versions of the spec implemented and the simple/formal domain model schemes. So now AROW talks to RO.Client and RO.Client talks to the RestfulObjects server. All of the spec and domain model scheme differences are abstracted by the RO.Client interface.

## Usage
Download a zip using the button above then follow the directions for your environment.

If you are using [Apache Isis](http://incubator.apache.org/isis/) with the quickstart-archetype:
* Copy arow/ and arow.html to the src/main/webapp folder of your webapp module.
* Launch the web server
* Access AROW at http://localhost:8080/arow.html

If you are using [RestfulObjects.NET](http://restfulobjects.codeplex.com):
* Copy arow/ and arow.html into your Run project (which generates the Restful Objects API)
* Launch the web server
* Access AROW at http://localhost:53176/arow.html (or wherever your server starts up)

You can also see a demo running at: http://simple-dusk-6870.herokuapp.com/arow-fpc.html  
Login as sven/pass and click the Projects > All Projects link to start.

## Caveats
* AROW has been tested against the Apache Isis restfulobjects-viewer implementing v0.52 of the RO spec and RestfulObjects.NET implementing v1.0.0 of the RO spec.
* And only on Chrome, Firefox, and Safari on Mac OSX and Windows and on the iPad.
* And only on a few models.
* And not everything works.

## Roadmap
Now on Trello at https://trello.com/board/arow/4ffb8a4180e91fc05e02dee5

## Thanks
Special thanks to:
* Dan Haywood for his help on the Apache Isis mailing lists
* Johan Andries for his work on [restfulobjects-js](http://code.google.com/p/restfulobjects-js/).
* Richard Pawson and Stef Cascarini for their help on the RestfulObjects.NET message boards

## License
Copyright (C) 2012 Adam Howard

Distributed under the MIT License.
