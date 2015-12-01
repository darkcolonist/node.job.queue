var myApp = angular.module('myApp', []);

myApp
  .factory('socket', function(){
    return io.connect('http://localhost:1028')
  })
  .controller('AppCtrl', ['$scope', 'socket', function($scope, socket){    
    $scope.queues = []

    socket.on('status', function(data){
      $scope.queues = data.queues
      $scope.tasks = data.tasks
      $scope.$digest()
    })

}]);