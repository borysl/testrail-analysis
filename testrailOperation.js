function TestrailOperation(testrailSettings, teamSettings) {
    var Testrail = require('testrail-api');

    var testrail = new Testrail({
        host: `${testrailSettings.protocol}://${testrailSettings.url}`,
        user: testrailSettings.login,
        password: testrailSettings.password
    });

    var self = this;
    var projectId = teamSettings.project_id;

    function adapt(callback) {
        var func = function(err, milestones) {
            callback(milestones, err);
        };
        return func;
    }

    self.getMilestones = function(callback) {
        testrail.getMilestones(projectId, adapt(callback));
    };

    self.getRuns = function(milestoneId, callback) {
        if (typeof milestoneId == 'function') {
            callback = milestoneId;
            testrail.getRuns(projectId, adapt(callback));
        } else {
            testrail.getRuns(projectId, {
                milestone_id: milestoneId
            }, adapt(callback));
        }
    };

    self.getTests = function(runId, callback) {
        testrail.getTests(runId, adapt(callback));
    };

    self.getResults = function(runId, callback) {
        testrail.getResultsForRun(runId, adapt(callback));
    };

    self.getStatuses = function(callback) {
        testrail.getStatuses(adapt(callback));
    };

    self.getCaseTypes = function(callback) {
        testrail.getCaseTypes(adapt(callback()));
    };

    self.getCases = function(suiteId, callback) {
        testrail.getCases(projectId, { suite_id: suiteId }, adapt(callback));
    };

    self.getCase = function(caseId, callback) {
        testrail.getCase(caseId, adapt(callback));
    };

    self.getSubmilestones = function(milestoneId, callback) {
        testrail.getMilestone(milestoneId, function(err, fullMilestone) {
            if (fullMilestone) {
                callback(fullMilestone.milestones, err);
            } else {
                callback(null, err);
            }
        });
    };

    self.getUsers = function(callback) {
        testrail.getUsers(adapt(callback));
    };

    return self;
}

module.exports = TestrailOperation;