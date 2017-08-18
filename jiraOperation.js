
var http = require("https");

var parseString = require('xml2js').parseString;

function JiraOperation(jiraSettings) {
    var self = this;

    var optionsTemplate = {
        "method": "GET",
        "hostname": jiraSettings.url,
        "port": null,
        "headers": {
            "content-type": "application/json",
            "authorization": "Basic " + new Buffer(jiraSettings.login + ':' + jiraSettings.password).toString('base64')
        }
    };

    function toType(obj) {
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    }

    function waitResponseFromGetRequest(query, callback) {
        var options = JSON.parse(JSON.stringify(optionsTemplate)); 

        options.path = query;

        var req = http.request(options, function (res) {
            var fullPath = `https://${options.hostname}${options.path}`;
            console.log(`Requesting: ${fullPath}`);
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var bodyBuffer = Buffer.concat(chunks);
                var bodyString = bodyBuffer.toString();
                if (bodyString.startsWith('<')) {
                    // something went wrong. Try it once more immediately
                        console.log(`Failure on getting ${fullPath}. Retrying...`);
                        waitResponseFromGetRequest(query, callback);
                    return;
                }
                var response = JSON.parse(bodyString);
                
                if (callback) {
                    if (response.error) {
                        callback(null, response.error); 
                    } else {
                        callback(response); 
                    }
                } else {
                    console.log(`Getting response ${response}`);
                }
            });

            res.on("error", function (err) {
                callback(null, err);
            });
        });

        req.end();
    }

    function getSubtasks(issuekey, callback) {
        var requestInfoOnIssue = `/rest/api/2/issue/${issuekey}/subtask`
        waitResponseFromGetRequest(requestInfoOnIssue, function (json) {
            var subtasks = json.map(_ => _.key);
            callback(subtasks);
        });
    }

    self.getTimesheet = function(issuekey, callback) {
      getSubtasks(issuekey, function(trackingTasks) {
        trackingTasks.push(issuekey);
        console.log(trackingTasks);
        var worklogs = [];
        timeTrackRequests = trackingTasks.map(task => new Promise(resolve => {
            getTaskWorklog(task, function (worklog) {
                worklog.forEach(_ => _.parentIssue = issuekey);
                worklogs = worklogs.concat(worklog);
                resolve();
            });
        }));

        Promise.all(timeTrackRequests).then(() => {
            callback(worklogs);
        });
    });
  }

  function getTaskWorklog(issuekey, callback) {
    var requestWorklogXml = `/rest/api/2/issue/${issuekey}/worklog`;
    waitResponseFromGetRequest(requestWorklogXml, function (json) {
          var worklogsFull = json.worklogs;
          if (worklogsFull) {
            var worklogsRefined = [];
            for (var i = 0; i < worklogsFull.length; i++) {
              var worklogFull = worklogsFull[i];
              var time = new Date(worklogFull.started);
              var worklogRefined = {
                issuekey: issuekey,
                authorEmail: worklogFull.author.emailAddress.toLowerCase(),
                day: new Date(time.getFullYear(), time.getMonth(), time.getDate()),
                spent: worklogFull.timeSpentSeconds / 60,
                comment: !worklogFull.comment.startsWith(jiraSettings.url) ? worklogFull.comment : "",
              }
              worklogsRefined.push(worklogRefined);
            }              
          }
          callback(worklogsRefined);
        });
  }
    
  return self;
}

module.exports = JiraOperation;