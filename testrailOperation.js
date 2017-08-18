var http = require("http");

function TestrailOperation(testrailSettings, teamSettings) {
    var self = this;
    var projectId = teamSettings.projectId;

    var optionsTemplate = {
        "method": "GET",
        "hostname": testrailSettings.url,
        "port": null,
        "path": "/index.php?/api/v2/",
        "headers": {
            "content-type": "application/json",
            "authorization": "Basic " + new Buffer(testrailSettings.login + ':' + testrailSettings.password).toString('base64')
        }
    };

    function waitResponseFromGetRequest(query, callback) {
        var options = JSON.parse(JSON.stringify(optionsTemplate)); 

        options.path += query;

        var req = http.request(options, function (res) {
            console.log(`Requesting: http://${options.hostname}${options.path}`);
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var body = Buffer.concat(chunks);
                var response = JSON.parse(body.toString())
                
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

    self.getMilestones = function (callback) {
        waitResponseFromGetRequest(`get_milestones/${projectId}`, callback);
    }

    self.getRuns = function (milestoneId, callback) {
        if (typeof milestoneId == "function") {
            callback = milestoneId;
            waitResponseFromGetRequest(`get_runs/${projectId}`, callback);
        } else {
            waitResponseFromGetRequest(`get_runs/${projectId}&milestone_id=${milestoneId}`, callback);
        }
    }

    self.getTests = function (runId, callback) {
        waitResponseFromGetRequest(`get_tests/${runId}`, callback);
    }

    self.getResults = function(runId, callback) {
        waitResponseFromGetRequest(`get_results_for_run/${runId}`, callback);
    }

    self.getStatuses = function (callback) {
        waitResponseFromGetRequest(`get_statuses`, callback);
    }

    self.getCaseTypes = function (callback) {
        waitResponseFromGetRequest(`get_case_types`, callback);
    }

    self.getCases = function (suiteId, callback) {
        waitResponseFromGetRequest(`get_cases/${projectId}&suite_id=${suiteId}`, callback);
    }

    self.getCase = function (caseId, callback) {
        waitResponseFromGetRequest(`get_case/${caseId}`, callback);
    }
    
    self.getSubmilestones = function (milestoneId, callback) {
        waitResponseFromGetRequest(`get_milestone/${milestoneId}`, function(fullMilestone, err) {
            if (fullMilestone) {
                callback(fullMilestone.milestones, err);
            } else {
                callback(null, err);
            }
        });
    }

    self.getUsers = function (callback) {
        waitResponseFromGetRequest(`get_users`, callback);
    }

    return self;
}

module.exports = TestrailOperation;