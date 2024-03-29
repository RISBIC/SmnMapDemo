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

    // Initialise empty collections
    $scope.icons = {};
    $scope.markers = {};
    $scope.outstations = {};

    // Track when requests are in progress
    $scope.responseCount = 0;
    $scope.inFlight = false;

    // Possible marker colors
    var markerColors = [
        'red','darkred','lightred','orange','beige',
        'green','darkgreen','lightgreen','blue','darkblue',
        'lightblue','purple','darkpurple','pink','cadetblue',
        'white','gray','lightgray','black'
    ];

    // Plot all outstations
    $scope.resetMarkers = function () {
        angular.forEach($scope.outstations, function (outstation, id) {
            $scope.markers[id] = {
                icon: { type: 'awesomeMarker', prefix: 'fa', icon: 'circle', markerColor: 'blue' },
                message: outstation.name + ' (' + outstation.description + ')',
                lng: outstation.location.coordinates[0],
                lat: outstation.location.coordinates[1]
            };
        })
    }

    // Fetch all outstations
    $scope.loadOutstations = function () {
        Outstations.query(function (outstations) {
            angular.forEach(outstations, function (outstation, index) {
                $scope.outstations[outstation.outstationid] = outstation;
            });

            $scope.resetMarkers();
        });
    };

    // Query all outstations for liveness
    $scope.queryLiveness = function () {
        $scope.responseCount = 0;
        $scope.inFlight = true;
        $scope.resetMarkers();

        angular.forEach($scope.outstations, function (outstation) {
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
        $scope.resetMarkers();

        angular.forEach($scope.outstations, function (outstation) {
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
        $scope.resetMarkers();

        Flows.query({reportPeriod: period}, function (flows) {
            $scope.inFlight = false;

            // Gray them all up and turn green the ones with info
            angular.forEach($scope.markers, function (marker) {
                marker.icon.markerColor = 'gray';
                marker.icon.icon = 'circle-o'
            });

            var grouped = _.groupBy(flows, 'outstationid');

            angular.forEach(grouped, function (group) {
                var max = _.max(group, 'volume');
                var marker = $scope.markers[max.outstationid];

                marker.icon.markerColor = 'green';
                marker.message = marker.message + ' (FLOW: ' + max.orientation + ')';

                if (max.orientation === 'N') { marker.icon.icon = 'arrow-n'; }
                else if (max.orientation === 'NE') { marker.icon.icon = 'arrow-ne'; }
                else if (max.orientation === 'E') { marker.icon.icon = 'arrow-e'; }
                else if (max.orientation === 'SE') { marker.icon.icon = 'arrow-se'; }
                else if (max.orientation === 'S') { marker.icon.icon = 'arrow-s'; }
                else if (max.orientation === 'SW') { marker.icon.icon = 'arrow-sw'; }
                else if (max.orientation === 'W') { marker.icon.icon = 'arrow-w'; }
                else if (max.orientation === 'NW') { marker.icon.icon = 'arrow-nw'; }
            });
        });
    }
}]);
