/*
Evenna webclient library

This javascript library handles all communication between Evennia and
whatever client front end is used.

The library will try to communicate with Evennia using websockets
(evennia/server/portal/webclient.py). However, if the web browser is
old and does not support websockets, it will instead fall back to a
long-polling (AJAX/COMET) type of connection (using
evennia/server/portal/webclient_ajax.py)

All messages is a valid JSON array on single form: ["cmdname",
kwargs], where kwargs is a JSON object that will be used as argument
to call the cmdname function.

This library makes the "Evennia" object available. It has the
following official functions:

   - Evennia.init(options)
        This can be called by the frontend to intialize the library. The
        argument is an js object with the following possible keys:
            'connection': This defaults to Evennia.WebsocketConnection but
                can also be set to Evennia.CometConnection for backwards
                compatibility. See below.
            'emitter': An optional custom command handler for distributing
                data from the server to suitable listeners. If not given,
                a default will be used. 
   - Evennia.msg(funcname, [args,...], callback)
        Send a command to the server. You can also provide a function
        to call with the return of the call (note that commands will 
        not return anything unless specified to do so server-side).

A "connection" object must have the method 
    - msg(data) - this should relay data to the Server. This function should itself handle
        the conversion to JSON before sending across the wire. 
    - When receiving data from the Server (always [cmdname, kwargs]), this must be 
        JSON-unpacked and the result redirected to Evennia.emit(data[0], data[1]).
An "emitter" object must have a function 
    - emit(cmdname, kwargs) - this will be called by the backend.
    - The default emitter also has the following methods: 
        - on(cmdname, listener) - this ties a listener to the backend. This function
            should be called as listener(kwargs) when the backend calls emit.
        - off(cmdname) - remove the listener for this cmdname.
   
*/

(function() {
    var cmdid = 0;
    var cmdmap = {};

    var evennia = {

        debug: true,

        // Initialize.
        // startup Evennia emitter and connection.
        //
        // Args:
        //   opts (obj): 
        //       emitter - custom emitter. If not given,
        //          will use a default emitter. Must have 
        //          an "emit" function.
        //       connection - This defaults to using either 
        //          a WebsocketConnection or a CometConnection
        //          depending on what the browser supports. If given
        //          it must have a 'msg' method and make use of
        //          Evennia.emit to return data to Client.
        //
        init: function(opts) { 
            opts = opts || {};
            this.emitter = opts.emitter || new DefaultEmitter();
            this.connection = opts.connection || window.Websocket ? new WebsocketConnection() : new AjaxConnection();
            },
        
        // Client -> Evennia. 
        // Called by the frontend to send a command to Evennia.
        //
        // Args:
        //   cmdname (str): String identifier to call
        //   kwargs (obj): Data argument for calling as cmdname(kwargs)
        //   callback (func): If given, will be given an eventual return
        //      value from the backend.
        // 
        msg: function (cmdname, kwargs, callback) {
            kwargs.cmdid = cmdid++;
            var data = kwargs ? [cmdname, kwargs] : [cmdname, {}];

            if (typeof callback === 'function') {
                this.cmdmap[cmdid] = callback;
            }
            this.connection.msg(data);

            log('cmd called with following args:', cmd, params, callback);
        },

        // Evennia -> Client.
        // Called by the backend to emit an event to the global emitter
        //
        // Args:
        //   event (event): Event received from Evennia
        //   data (obj):  
        //
        emit: function (cmdname, data) {
            if (data.cmdid) {
                this.cmdmap[data.cmdid].apply(this, [data]);
                delete this.cmdmap[cmddata.cmdid];
            }
            else {
                this.emitter.emit(cmdname, data);
            }
        },

    }; // end of evennia object

    
    // Basic emitter to distribute data being sent to the client from
    // the Server. An alternative can be overridden in Evennia.init.
    //
    var DefaultEmitter = function () {
        var cmdmap = {};
        // Emit data to all listeners tied to a given cmdname
        //
        // Args:
        //   cmdname (str): Name of command, used to find
        //     all listeners to this call; each will be
        //     called as function(kwargs).
        //   kwargs (obj): Argument to the listener.
        //
        var emit = function (cmdname, kwargs) {
            log('emit', cmdname, kwargs);

            if (this.cmdmap[cmdname]) {
                this.cmdmap[cmdname].apply(this, kwargs);
            };
        };

        // Bind listener to event
        //
        // Args:
        //   cmdname (str): Name of event to handle.
        //   listener (function): Function taking one argument,
        //     to listen to cmdname events. 
        //
        var on = function (cmdname, listener) {
            if typeof(listener === 'function') {
                this.cmdmap[cmdname] = listener;
            };
        };

        // remove handling of this cmdname
        //
        // Args:
        //   cmdname (str): Name of event to handle
        //
        var off = function (cmdname) {
            delete this.cmdmap[cmdname]
        };
        return {emit:emit, on:on, off:off}
    };

    // Websocket Connector
    //
    var WebsocketConnection = function () {
        var websocket = new WebSocket(wsurl);
        // Handle Websocket open event
        this.websocket.onopen = function (event) {
            log('Websocket connection openened.');
            Evennia.emit('socket:open', event);
        };
        // Handle Websocket close event
        this.websocket.onclose = function (event) {
            log('WebSocket connection closed.');
            Evennia.emit('socket:close', event);
        };
        // Handle websocket errors
        this.websocket.onerror = function (event) {
            log("Websocket error to ", wsurl, event);
            Evennia.emit('socket:error', data);
        };
        // Handle incoming websocket data
        this.websocket.onmessage = function (event) {
            var data = event.data
            if (typeof data !== 'string' && data.length < 0) {
                return;
            }
            // Parse the incoming data, send to emitter
            // Incoming data is on the form [cmdname, kwargs]
            data = JSON.parse(data);
            Evennia.emit(data[0], data[1]]);
        };
        this.websocket.msg = function(data) {
            this.websocket.send(JSON.stringify(data));
        };

        return websocket;
    }

    // AJAX/COMET Connector
    //
    CometConnection = function() {
        var client_hash = '0';
    
        var ajaxcomet = {
            // Send Client -> Evennia. Called by Evennia.send.
            var msg = function(data) {
                $.ajax({type: "POST", url: "/webclientdata",
                       async: true, cache: false, timeout: 30000,
                       dataType: "json",
                       data: {mode:'input', msg: data, 'suid': client_hash},
                       success: function(data): {},
                       error: function(req, stat, err): {
                           log("COMET: Server returned error. " + err)
                       }
               });
            };

            // Receive Evennia -> Client. This will start an asynchronous
            // Long-polling request. It will either timeout or receive data
            // from the 'webclientdata' url. Either way a new polling request
            // will immediately be started.
            var poll = function() {
                $.ajax({type: "POST", url: "/webclientdata",
                        async: true, cache: false, timeout: 30000,
                        dataType: "json",
                        data = {mode: 'receive', 'suid': client_hash},
                        success: function(data) {
                           Evennia.emit(data[0], data[1])
                        },
                        error: function() {
                            this.poll()  // timeout; immediately re-poll
                        }
                });
            };
            
            // Initialization will happen when this Connection is created. 
            // We need to store the client id so Evennia knows to separate
            // the clients. 
            $.ajax({type: "POST", url: "/webclientdata",
                    async: true, cache: false, timeout: 50000,
                    datatype: "json",
                    success: function(data) {
                        this.client_hash = data.suid;
                        this.poll();
                    },
                    error: function(req, stat, err) {
                        log("Connection error: " + err);
                    }
            });
        };

        return ajaxcomet;
        };

    window.Evennia = evennia;

})(); // end of auto-calling Evennia object defintion

// helper logging function
// Args:
//   msg (str): Message to log to console.
//
function log(msg) {
  if (Evennia.debug) {
    console.log(msg);
  }
}

// Called when page has finished loading (kicks the client into gear)
$(document).ready(function(){
    
    // a small timeout to stop 'loading' indicator in Chrome
    setTimeout(function () {
      log('Evennia initialized...')
      Evennia.init()

    }, 500);
    // set an idle timer to avoid proxy servers to time out on us (every 3 minutes)
    setInterval(function() {
      log('Idle tick.');
    }, 60000*3);
});
