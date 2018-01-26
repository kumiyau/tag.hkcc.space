define(function(require, exports, module) {
    var moment = require('moment');

    // timezone = {
    //     TZID: "Asia/Hong_Kong",
    //     TZNAME: "HKT",
    //     OFFSETFROM: "+0800",
    //     OFFSETTO: "+0800",
    //     START: "19700101T000000"
    // }
    var ics = function(company, applicationName, domain, timezone) {
        function _(o, dateOnly) {
            function escapeChars(str) {
                str = str.replace(/\,/g, "\\,");
                str = str.replace(/\r/g, "\\r");
                str = str.replace(/\n/g, "\\n");
                return str;
            }
            if (typeof o === "string") {
                return escapeChars(o);
            }
            if (typeof o === "number") {
                return escapeChars(new String(o));
            }
            if (moment.isMoment(o)) {
                if (dateOnly) {
                    return o.format('YYYYMMDD')
                }
                return o.format('YYYYMMDDTHHmmss');
            }
            if (Array.isArray(o)) {
                var p = [];
                for (var i = 0; i < o.length; i++) {
                    p.push(_(o[i]));
                }
                return p.join(',');
            }
            throw "object type not supported: " + typeof o;
        }
        // createFromRawEvent({
        //  DTSTART: {
        //      value: moment(),
        //      TZID: "Asia/Hong_Kong",
        //  },
        //  DTEND: {
        //      value: moment(),
        //      TZID: "Asia/Hong_Kong",
        //  },
        //  RRULE: {
        //      FREQ: "WEEKLY",
        //      UNTIL: moment(),
        //      INTERVAL: 1,
        //      BYDAY: ["TU"],
        //  },
        //  EXDATE: {
        //      value: [moment(),moment()],
        //      TZID: "Asia/Hong_Kong",
        //  },
        //  DTSTAMP: {
        //      // DTSTAMP:20170120T095045Z
        //      // The property indicates the date/time that the instance of the iCalendar object was created.
        //      value: moment()
        //  },
        //  UID: {
        //      value: "20170207T113000-20170207T133000-CCN2049@tag"
        //  },
        //  DESCRIPTION: {
        //      value: "CCN2049 - CHINESE AND WESTERN CULTURES\nGroup: 204A\nWeek: 1 - 13 for every 1"
        //  },
        //  LOCATION: {
        //      value: "RM UG05, Hung Hom Bay"
        //  },
        //  SUMMARY: {
        //      value: "CCN2049-C&W, Lecture, 204A"
        //  }
        // });
        function createFromRawEvent(obj) {
            var icalEvent = [
                'BEGIN:VEVENT'
            ];


            if (!typeof obj === "object") {
                throw "expect object in obj."
            }

            for (var propertyName in obj) {
                var property = obj[propertyName];
                
                var propertyStr = propertyName.toUpperCase();

                if (propertyName === "RRULE") {
                    propertyStr += ':';
                }

                for (var paramName in property) {
                    var paramValue = property[paramName];
                    var useDate = false;

                    if (paramName === 'value') {
                        continue;
                    }

                    if (paramName === 'VALUE' && paramValue === 'DATE') {
                        useDate = true;
                    }

                    if (propertyStr[propertyStr.length -1] !== ':') {
                        propertyStr += ';';
                    }
                    propertyStr += paramName.toUpperCase() + '=' + _(paramValue);
                }

                if (property.value !== undefined) {
                    propertyStr += ':' + _(property.value, useDate);
                }

                if ((propertyName === "DTSTART" || propertyName === "DTEND" || propertyName === "EXDATE" || 
                            propertyName === "DTSTAMP") && !property.TZID && !useDate) {
                    propertyStr += "Z";
                }

                icalEvent.push(propertyStr);
            }


            icalEvent.push('END:VEVENT');

            return icalEvent.join('\r\n');
        }

        var CRLF = '\r\n';

        var calendarEvents = [];
        var calendarStart = [
            'BEGIN:VCALENDAR',
            'PRODID:-//' + _(company) + '//' + _(applicationName) + '//EN',
            'VERSION:2.0',

            'BEGIN:VTIMEZONE',
            'TZID:' + timezone.TZID,
                'BEGIN:STANDARD',
                'TZOFFSETFROM:' + timezone.OFFSETFROM,
                'TZOFFSETTO:' + timezone.OFFSETTO,
                'TZNAME:' + timezone.TZNAME,
                'DTSTART:' + timezone.START,
                'END:STANDARD',
            'END:VTIMEZONE',
        ].join(CRLF);

        var calendarEnd = 'END:VCALENDAR';


        return {
            'events': function() {
                return calendarEvents;
            },

            'calendar': function() {
                return calendarStart + CRLF + calendarEvents.join(CRLF) + CRLF + calendarEnd;
            },

            // recursiveOpts = {
            //  frequency: "WEEKLY",
            //  until: moment(),
            //  interval: 1,
            //  byDay: ["TU"],
            //  except: [          // (optional)
            //      moment(),moment(),moment()
            //  ]
            // }
            'addEvent': function (summary, description, location, start, end, allDay, recursiveOpts) {
                var rawEvent = {};

                rawEvent.DTSTART = {
                    value: start
                };
                if (end) {
                    rawEvent.DTEND = {
                        value: end
                    };
                }

                if (allDay) {
                    rawEvent.DTSTART.VALUE = 'DATE';
                    rawEvent.DTEND.VALUE = 'DATE';
                }
                else {
                    rawEvent.DTSTART.TZID = timezone.TZID;
                    rawEvent.DTEND.TZID = timezone.TZID;
                }

                if (description) {
                    rawEvent.DESCRIPTION = {
                        value: description
                    };
                }
                if (location) {
                    rawEvent.LOCATION = {
                        value: location
                    };
                }
                if (summary) {
                    rawEvent.SUMMARY = {
                        value: summary
                    };
                }

                rawEvent.UID = {
                    value: _(start) + '-' + _(end) + '-' + 
                        Math.random().toString(16).slice(-8) + '@' + domain
                };
                rawEvent.DTSTAMP = {
                    value: moment().utc()
                };
                if (recursiveOpts) {
                    var byDay = [];

                    for (var i = 0; i < recursiveOpts.byDay.length; i++) {
                        byDay.push(moment(recursiveOpts.byDay[i], "ddd dddd").format('dd').toUpperCase());
                    }

                    rawEvent.RRULE = {
                        FREQ: recursiveOpts.frequency,
                        UNTIL: recursiveOpts.until,
                        INTERVAL: recursiveOpts.interval,
                        BYDAY: byDay,
                    };

                    if (recursiveOpts.except && recursiveOpts.except.length > 0) {
                        rawEvent.EXDATE = {
                            TZID: timezone.TZID,
                            value: recursiveOpts.except
                        };
                    }
                }

                calendarEvents.push(createFromRawEvent(rawEvent));
            }
            
        };
    };

    module.exports = ics;
});
