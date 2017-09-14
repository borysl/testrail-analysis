var http = require('https');

function JiraOperation(jiraSettings) {
    var self = this;

    var optionsTemplate = {
        'method': 'GET',
        'hostname': jiraSettings.url,
        'port': null,
        'headers': {
            'content-type': 'application/json',
            'authorization': 'Basic ' + new Buffer(jiraSettings.login + ':' + jiraSettings.password).toString('base64')
        }
    };

    function processRequest(query, callback) {
        var options = JSON.parse(JSON.stringify(optionsTemplate));
        options.path = query;

        processRequestByOptions(options, callback);

        function processRequestByOptions(options, callback, fault) {
            var req = http.request(options, function(res) {
                var fullPath = `https://${options.hostname}${options.path}`;
                console.log(`Requesting: ${fullPath}`);
                var chunks = [];

                res.on('data', function(chunk) {
                    chunks.push(chunk);
                });

                res.on('end', function() {
                    var bodyBuffer = Buffer.concat(chunks);
                    var bodyString = bodyBuffer.toString();
                    try {
                        var response = JSON.parse(bodyString);

                        if (callback) {
                            if (response.errors) {
                                callback(null, response.errors);
                            } else {
                                callback(response);
                            }
                        } else {
                            console.log('Success!');
                        }
                    } catch (e) {
                        // something went wrong. Try it once more immediately
                        if (!fault) {
                            console.log(`Retrying on failure ${options.method} on ${options.path}.`);
                            processRequestByOptions(options, callback, true);
                        } else {
                            callback(null, new Error(`Failure ${options.method} on ${options.path}.`));
                        }
                        return;
                    }
                });

                res.on('error', function(err) {
                    callback(null, err);
                });
            });

            req.end();
        }
    }

    function getSubtasks(issuekey, callback) {
        var requestInfoOnIssue = `/rest/api/2/issue/${issuekey}/subtask`;
        processRequest(requestInfoOnIssue, function(json) {
            var subtasks = json.map(_ => _.key);
            callback(subtasks);
        });
    }

    self.getTimesheet = function(issuekey, callback) {
        getSubtasks(issuekey, function(trackingTasks) {
            trackingTasks.push(issuekey);
            console.log(trackingTasks);
            var worklogs = [];
            var timeTrackRequests = trackingTasks.map(task => new Promise(resolve => {
                getTaskWorklog(task, function(worklog) {
                    worklog.forEach(_ => _.parentIssue = issuekey);
                    worklogs = worklogs.concat(worklog);
                    resolve();
                });
            }));

            Promise.all(timeTrackRequests).then(() => {
                callback(worklogs);
            });
        });
    };

    function getTaskWorklog(issuekey, callback) {
        var requestWorklogXml = `/rest/api/2/issue/${issuekey}/worklog`;
        processRequest(requestWorklogXml, function(json) {
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
                        comment: !worklogFull.comment.startsWith(jiraSettings.url) ? worklogFull.comment : '',
                    };
                    worklogsRefined.push(worklogRefined);
                }
            }
            callback(worklogsRefined);
        });
    }

    return self;
}

module.exports = JiraOperation;