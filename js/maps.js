var API_URL = 'http://reports-testarjuna.rhcloud.com/';

angular.module('maps', [ 'ngResource', 'angularMoment', 'ui.bootstrap', 'snap', 'leaflet-directive' ]);

// HTML5 Location Mode
angular.module('maps').config(['$locationProvider',
    function ($locationProvider) {
        $locationProvider.hashPrefix('!');
    }
]);

// Service to get Outstations
angular.module('maps').factory('Outstations', ['$resource', function ($resource) {
    return $resource(API_URL + 'outstations/:outstationId');
}]);


// Service to get Summaries
angular.module('maps').factory('Summaries', ['$resource', function ($resource) {
    return $resource(API_URL + 'outstations/:outstationId/:reportType/:reportPeriod');
}]);

// Service to get Flow summary
angular.module('maps').factory('Flows', ['$resource', function ($resource) {
    return $resource(API_URL + 'flow/:reportPeriod');
}]);

// Controller to Handle Outstations and Summaries
angular.module('maps').controller('MapsController', ['$scope', 'Outstations', 'Summaries', 'Flows', function ($scope, Outstations, Summaries, Flows) {

    // Set center to Newcastle
    $scope.center = {
        lat: 54.999,
        lng: -1.65,
        zoom: 13
    };

    // Disable right drawer + dragging
    $scope.snapOpts = {
        disable: 'right',
        touchToDrag: false
    }

    // Initialise empty icons collection
    $scope.icons = {};

    // Initialise empty markers collection
    $scope.markers = {};

    // Initialise 0 responses
    $scope.responseCount = 0;
    $scope.inFlight = false;

    // Possible marker colors
    var markerColors = [
        'red','darkred','lightred','orange','beige',
        'green','darkgreen','lightgreen','blue','darkblue',
        'lightblue','purple','darkpurple','pink','cadetblue',
        'white','gray','lightgray','black'
    ];

    // Fetch all outstations
    $scope.loadOutstations = function () {
        Outstations.query(function (outstations) {
            $scope.outstations = {};
            $scope.outstationCount = outstations.length;

            // Plot each outstation on the map
            angular.forEach(outstations, function (outstation, index) {
                $scope.outstations[outstation.outstationid] = outstation;

                $scope.markers[outstation.outstationid] = {
                    icon: { type: 'awesomeMarker', prefix: 'fa', icon: 'circle', markerColor: 'blue' },
                    message: outstation.name + ' (' + outstation.description + ')',
                    lng: outstation.location.coordinates[0],
                    lat: outstation.location.coordinates[1]
                };
            });
        });
    };

    // Query all outstations for liveness
    $scope.queryLiveness = function () {
        $scope.responseCount = 0;
        $scope.inFlight = true;

        angular.forEach($scope.outstations, function (outstation, index) {
            $scope.markers[outstation.outstationid].icon.markerColor = 'blue';
            $scope.markers[outstation.outstationid].icon.icon = 'circle';

            Outstations.get({outstationId: outstation.outstationid}, function (result) {
                $scope.responseCount++;
                $scope.inFlight = false;

                var icon = 'gray';
                var differenceText = 'Never'

                if (result.lastupdate) {
                    var lastUpdate = moment.utc(result.lastupdate);

                    var difference = moment.utc().diff(lastUpdate, 'days');
                    differenceText = lastUpdate.fromNow();

                    if (difference <= 1) { icon = 'green' }
                    else if (difference <= 7) { icon = 'orange' }
                    else { icon = 'red' }
                }

                $scope.markers[result.outstationid].icon.markerColor = icon;
                $scope.markers[result.outstationid].message = $scope.markers[result.outstationid].message + ' (Last: ' + differenceText + ')';
            });
        });
    }

    // Query all outstations for last week's average speed
    $scope.querySpeed = function () {
        $scope.responseCount = 0;
        $scope.inFlight = true;

        angular.forEach($scope.outstations, function (outstation, index) {
            $scope.markers[outstation.outstationid].icon.markerColor = 'blue';
            $scope.markers[outstation.outstationid].icon.icon = 'circle';

            var query = {
                outstationId: outstation.outstationid,
                reportType: 'speed',
                reportPeriod: 'week',
                order: 'desc',
                count: 1
            };

            Summaries.query(query, function (summaries) {
                $scope.responseCount++;
                $scope.inFlight = false;

                var icon = 'gray'

                if (summaries.length > 0) {
                    var speedLimit = parseInt($scope.outstations[summaries[0].outstationid].speedlimit);
                    var percentile = parseInt(summaries[0].speed_85th_percentile);

                    if (speedLimit !== 0 && percentile !== 0) {
                        var ratio = (percentile/speedLimit);

                        if (ratio <= 1.1) { icon = 'green' }
                        else if (ratio <= 1.25) { icon = 'orange' }
                        else { icon = 'red' }
                    }
                }

                $scope.markers[outstation.outstationid].icon.markerColor = icon;
            });
        });
    }


    // Query flow information
    $scope.queryFlow = function (period) {
        $scope.inFlight = true;

        Flows.query({reportPeriod: period}, function (flows) {
            $scope.inFlight = false;

            // Gray them all up and turn green the ones with info
            _.each($scope.markers, function (marker) {
                marker.icon.markerColor = 'gray';
                marker.icon.icon = 'circle-o'
            });

            var grouped = _.groupBy(flows, 'outstationid');

            _.each(grouped, function (group, oid) {
                var max = _.max(group, 'volume');

                $scope.markers[max.outstationid].icon.markerColor = 'green';
                $scope.markers[max.outstationid].message = $scope.markers[max.outstationid].message + ' (FLOW: ' + max.orientation + ')';

                if (max.orientation === 'N') { $scope.markers[max.outstationid].icon.icon = 'arrow-up'; }
                else if (max.orientation === 'S') { $scope.markers[max.outstationid].icon.icon = 'arrow-down'; }
                else if (max.orientation === 'E') { $scope.markers[max.outstationid].icon.icon = 'arrow-right'; }
                else if (max.orientation === 'W') { $scope.markers[max.outstationid].icon.icon = 'arrow-left'; }
                else if (max.orientation === 'NE') { $scope.markers[max.outstationid].icon.icon = 'arrow-right'; }
                else if (max.orientation === 'SE') { $scope.markers[max.outstationid].icon.icon = 'arrow-right'; }
                else if (max.orientation === 'NW') { $scope.markers[max.outstationid].icon.icon = 'arrow-left'; }
                else if (max.orientation === 'SW') { $scope.markers[max.outstationid].icon.icon = 'arrow-left'; }
            });
        });
    }
}]);
