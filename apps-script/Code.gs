/**
 * NiHao / CALICON — Google Sheets API.
 *
 * Bound this project to the NiHao spreadsheet (Extensions → Apps Script),
 * then run setupWorkbook once. It creates any missing tabs and never
 * deletes existing rows.
 *
 * The rules here mirror src/domain/store.ts. If you change one, change both.
 *
 * File: https://docs.google.com/spreadsheets/d/12_06cUzeK2OQ6gw78-777AftCKdLAfCCxcMCYawcehg
 * Open Extensions → Apps Script from that sheet. The id below is only used
 * when this script is not opened from the sheet itself.
 */
var SPREADSHEET_ID = '12_06cUzeK2OQ6gw78-777AftCKdLAfCCxcMCYawcehg';
var SESSION_MS = 30 * 24 * 60 * 60 * 1000;
var LEGACY_DEMO_HASH =
  'a7919e675fdc7cd8c01948a16dee261d86921d6d7d300c0a8d59860c50a1567c';

var HEADERS = {
  contributors: ['contributor_id', 'display_name', 'username', 'password_hash', 'email', 'phone', 'active_code', 'push_token', 'updated_at'],
  projects: ['project_id', 'client_name', 'project_type', 'status', 'phone', 'email', 'address', 'started_date', 'completed_date', 'updated_at', 'last_updated_by', 'active_code', 'version'],
  project_comments: ['comment_id', 'project_id', 'comment', 'added_by', 'added_date', 'active_code'],
  project_payments: ['payment_id', 'project_id', 'amount', 'date', 'received_by', 'voided', 'void_reason', 'voided_by', 'voided_at'],
  project_billing: ['billing_id', 'project_id', 'quoted_amount', 'final_amount', 'received_amount', 'pending_amount', 'gst_included', 'version'],
  project_contributors: ['id', 'project_id', 'contributor_id', 'active_status'],
  expenses: ['expense_id', 'title', 'notes', 'amount', 'paid_by', 'expense_date', 'recurring_status', 'frequency', 'active_code', 'updated_at', 'version'],
  expense_contributors: ['id', 'expense_id', 'contributor_id', 'active_status'],
  tasks: ['task_id', 'task_name', 'task_description', 'status', 'created_by', 'created_date', 'active_status', 'updated_at', 'version'],
  task_comments: ['comment_id', 'task_id', 'comment', 'added_by', 'added_date', 'active_code'],
  settlements: ['settlement_id', 'from_contributor_id', 'to_contributor_id', 'amount', 'date', 'project_id', 'expense_id', 'note', 'created_by', 'created_at', 'voided', 'void_reason'],
  sessions: ['token_hash', 'contributor_id', 'expires_at'],
  idempotency: ['key', 'result_json'],
};

var PUBLIC_SHEETS = [
  'contributors', 'projects', 'project_comments', 'project_payments', 'project_billing',
  'project_contributors', 'expenses', 'expense_contributors', 'tasks', 'task_comments', 'settlements',
];

function doGet() {
  return json_({ ok: true, data: { service: 'NiHao Sheets API' } });
}

function doPost(e) {
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    var data = withLock_(function () {
      return dispatch_(body);
    });
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({
      ok: false,
      error: String(err.message || err),
      code: err.code || 'SERVER',
    });
  }
}

function setupWorkbook() {
  var ss = spreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(HEADERS[name]);
      return;
    }
    var width = Math.max(sh.getLastColumn(), 1);
    var current = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
      return String(h || '');
    });
    if (current.join('') === '') {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      return;
    }
    HEADERS[name].forEach(function (header) {
      if (current.indexOf(header) === -1) {
        current.push(header);
      }
    });
    sh.getRange(1, 1, 1, current.length).setValues([current]);
  });

  var people = readSheet_('contributors');
  if (people.length) return;
  var now = new Date().toISOString();
  var users = [
    ['c_akhil', 'Akhil', 'akhil', LEGACY_DEMO_HASH, 'akhil@calicon.in', '9000000001', 'active', '', now],
    ['c_chiranjeev', 'Chiranjeev', 'chiranjeev', LEGACY_DEMO_HASH, 'chiranjeev@calicon.in', '9000000002', 'active', '', now],
    ['c_manav', 'Manav', 'manav', LEGACY_DEMO_HASH, 'manav@calicon.in', '9000000003', 'active', '', now],
  ];
  var sheet = ss.getSheetByName('contributors');
  users.forEach(function (row) {
    sheet.appendRow(row);
  });
}

function dispatch_(body) {
  var key = String(body.idempotencyKey || '');
  if (key) {
    var prior = readIdempotency_(key);
    if (prior !== null) return prior;
  }
  var action = body.action;
  var result;
  if (action === 'login') result = login_(body);
  else if (action === 'bootstrap') result = bootstrap_(body);
  else if (action === 'saveProject') result = saveProject_(body);
  else if (action === 'saveTask') result = saveTask_(body);
  else if (action === 'saveExpense') result = saveExpense_(body);
  else if (action === 'saveBilling') result = saveBilling_(body);
  else if (action === 'addProjectComment') result = addProjectComment_(body);
  else if (action === 'addTaskComment') result = addTaskComment_(body);
  else if (action === 'addPayment') result = addPayment_(body);
  else if (action === 'voidPayment') result = voidPayment_(body);
  else if (action === 'setActive') result = setActive_(body);
  else if (action === 'updateContributorProfile') result = updateProfile_(body);
  else if (action === 'savePushToken') result = savePushToken_(body);
  else if (action === 'addSettlement') result = addSettlement_(body);
  else if (action === 'voidSettlement') result = voidSettlement_(body);
  else fail_('SERVER', 'Unknown action');
  if (key) writeIdempotency_(key, result);
  return result;
}

function login_(body) {
  var identifier = String(body.identifier || '').trim().toLowerCase();
  var password = String(body.password || '');
  if (!identifier || !password) fail_('VALIDATION', 'Enter your username and password.');
  var rows = readSheet_('contributors');
  var found = null;
  for (var i = 0; i < rows.length; i++) {
    var c = rows[i];
    if (c.active_code !== 'active') continue;
    var match =
      String(c.username || '').toLowerCase() === identifier ||
      String(c.email || '').toLowerCase() === identifier ||
      String(c.phone || '').trim() === identifier;
    if (match) {
      found = c;
      break;
    }
  }
  if (!found || !passwordMatches_(String(found.password_hash || ''), password)) {
    fail_('AUTH_FAILED', 'Invalid login credentials.');
  }
  if (String(found.password_hash || '').indexOf('v2$') !== 0) {
    found.password_hash = hashPassword_(password);
    found.updated_at = new Date().toISOString();
    writeUpsert_('contributors', 'contributor_id', found);
  }
  var token = Utilities.getUuid() + Utilities.getUuid();
  writeUpsert_('sessions', 'token_hash', {
    token_hash: sha256_(token),
    contributor_id: found.contributor_id,
    expires_at: new Date(Date.now() + SESSION_MS).toISOString(),
  });
  return { token: token, user: publicUser_(found) };
}

function bootstrap_(body) {
  requireUser_(body);
  var out = {};
  PUBLIC_SHEETS.forEach(function (name) {
    var rows = readSheet_(name);
    if (name === 'contributors') {
      rows = rows.map(publicUser_);
    }
    out[name] = rows;
  });
  return out;
}

function saveProject_(body) {
  var actor = requireUser_(body);
  var input = body.project || {};
  var clientName = requireText_(input.client_name, 'Client name', 120);
  var projects = readSheet_('projects');
  var existing = null;
  for (var i = 0; i < projects.length; i++) {
    if (String(projects[i].project_id) === String(input.project_id || '')) existing = projects[i];
  }
  if (input.project_id && !existing && Number(body.expectedVersion || 0) > 0) {
    fail_('NOT_FOUND', 'That project no longer exists.');
  }
  if (existing) assertVersion_(existing, body.expectedVersion);
  for (var d = 0; d < projects.length; d++) {
    var other = projects[d];
    if (other.active_code === 'inactive') continue;
    if (existing && String(other.project_id) === String(existing.project_id)) continue;
    if (String(other.client_name || '').trim().toLowerCase() === clientName.toLowerCase()) {
      fail_('DUPLICATE', 'A project named "' + other.client_name + '" already exists.');
    }
  }
  var status = oneOf_(input.status, 'Status', ['Potential', 'In Progress', 'On Hold', 'In Testing', 'Completed'], 'Potential');
  var now = new Date().toISOString();
  var row = {
    project_id: existing ? existing.project_id : input.project_id || Utilities.getUuid(),
    client_name: clientName,
    project_type: optionalText_(input.project_type, 'Project type', 80),
    status: status,
    phone: optionalPhone_(input.phone),
    email: optionalEmail_(input.email),
    address: optionalText_(input.address, 'Address', 300),
    started_date: optionalDate_(input.started_date || (existing && existing.started_date) || now.slice(0, 10), 'Start date'),
    completed_date: optionalDate_(
      status === 'Completed'
        ? input.completed_date || (existing && existing.completed_date) || now.slice(0, 10)
        : input.completed_date || (existing && existing.completed_date) || '',
      'Completed date',
    ),
    updated_at: now,
    last_updated_by: actor.contributor_id,
    active_code: existing && existing.active_code === 'inactive' ? 'inactive' : 'active',
    version: bump_(existing),
  };
  writeUpsert_('projects', 'project_id', row);
  if (body.contributorIds) syncPeople_('project', row.project_id, body.contributorIds);
  if (body.gstIncluded === 'yes' || body.gstIncluded === 'no') setProjectGst_(row.project_id, body.gstIncluded);
  notify_(existing ? 'Project updated' : 'Project added', actor.display_name + ' · ' + row.client_name);
  if (!existing) {
    var bills = readSheet_('project_billing');
    var has = false;
    for (var b = 0; b < bills.length; b++) {
      if (String(bills[b].project_id) === String(row.project_id)) has = true;
    }
    if (!has) {
      writeUpsert_('project_billing', 'billing_id', {
        billing_id: Utilities.getUuid(),
        project_id: row.project_id,
        quoted_amount: 0,
        final_amount: 0,
        received_amount: 0,
        pending_amount: 0,
        gst_included: 'yes',
        version: 1,
      });
    }
  }
  return row;
}

function saveTask_(body) {
  var actor = requireUser_(body);
  var input = body.task || {};
  var name = requireText_(input.task_name, 'Task name', 140);
  var tasks = readSheet_('tasks');
  var existing = findBy_(tasks, 'task_id', input.task_id);
  if (input.task_id && !existing && Number(body.expectedVersion || 0) > 0) {
    fail_('NOT_FOUND', 'That task no longer exists.');
  }
  if (existing) assertVersion_(existing, body.expectedVersion);
  for (var i = 0; i < tasks.length; i++) {
    var other = tasks[i];
    if (other.active_status === 'inactive') continue;
    if (existing && String(other.task_id) === String(existing.task_id)) continue;
    if (String(other.task_name || '').trim().toLowerCase() === name.toLowerCase()) {
      fail_('DUPLICATE', 'A task named "' + other.task_name + '" already exists.');
    }
  }
  var now = new Date().toISOString();
  var row = {
    task_id: existing ? existing.task_id : Utilities.getUuid(),
    task_name: name,
    task_description: optionalText_(input.task_description, 'Description', 2000),
    status: oneOf_(input.status, 'Status', ['Open', 'In Progress', 'Complete'], 'Open'),
    created_by: existing ? existing.created_by : actor.contributor_id,
    created_date: existing ? existing.created_date : now,
    active_status: existing && existing.active_status === 'inactive' ? 'inactive' : 'active',
    updated_at: now,
    version: bump_(existing),
  };
  writeUpsert_('tasks', 'task_id', row);
  return row;
}

function saveExpense_(body) {
  var actor = requireUser_(body);
  var input = body.expense || {};
  var title = requireText_(input.title, 'Title', 140);
  var value = amount_(input.amount, 'Amount', 0);
  var expenseDate = optionalDate_(input.expense_date || today_(), 'Expense date');
  var expenses = readSheet_('expenses');
  var existing = findBy_(expenses, 'expense_id', input.expense_id);
  if (input.expense_id && !existing && Number(body.expectedVersion || 0) > 0) {
    fail_('NOT_FOUND', 'That expense no longer exists.');
  }
  if (existing) assertVersion_(existing, body.expectedVersion);
  if (!existing) {
    for (var i = 0; i < expenses.length; i++) {
      var other = expenses[i];
      if (other.active_code === 'inactive') continue;
      if (
        String(other.title || '').trim().toLowerCase() === title.toLowerCase() &&
        String(other.expense_date || '') === expenseDate &&
        Number(other.amount) === value
      ) {
        fail_('DUPLICATE', 'An expense with the same title, date and amount already exists.');
      }
    }
  }
  var recurring = input.recurring_status === 'yes' ? 'yes' : 'no';
  var row = {
    expense_id: existing ? existing.expense_id : Utilities.getUuid(),
    title: title,
    notes: optionalText_(input.notes, 'Notes', 2000),
    amount: value,
    paid_by: existing ? existing.paid_by : actor.contributor_id,
    expense_date: expenseDate,
    recurring_status: recurring,
    frequency: recurring === 'yes' ? oneOf_(input.frequency, 'Frequency', ['', 'Daily', 'Weekly', 'Monthly', 'Yearly'], 'Monthly') : '',
    active_code: existing && existing.active_code === 'inactive' ? 'inactive' : 'active',
    updated_at: new Date().toISOString(),
    version: bump_(existing),
  };
  writeUpsert_('expenses', 'expense_id', row);
  if (body.contributorIds) syncPeople_('expense', row.expense_id, body.contributorIds);
  return row;
}

function saveBilling_(body) {
  var actor = requireUser_(body);
  var input = body.billing || {};
  var bills = readSheet_('project_billing');
  var billing = findBy_(bills, 'billing_id', input.billing_id);
  if (!billing) fail_('NOT_FOUND', 'Billing record not found.');
  assertVersion_(billing, body.expectedVersion);
  billing.quoted_amount = amount_(input.quoted_amount, 'Quoted amount', 0, billing.quoted_amount);
  billing.final_amount = amount_(input.final_amount, 'Final amount', 0, billing.final_amount);
  billing.gst_included = input.gst_included === 'no' ? 'no' : 'yes';
  writeUpsert_('project_billing', 'billing_id', billing);
  recomputeBilling_(billing.project_id);
  touchProject_(billing.project_id, actor.contributor_id);
  return findBy_(readSheet_('project_billing'), 'billing_id', billing.billing_id);
}

function addProjectComment_(body) {
  var actor = requireUser_(body);
  var project = findBy_(readSheet_('projects'), 'project_id', body.projectId);
  if (!project || project.active_code === 'inactive') fail_('NOT_FOUND', 'That project no longer exists.');
  var row = {
    comment_id: Utilities.getUuid(),
    project_id: project.project_id,
    comment: requireText_(body.comment, 'Comment', 2000),
    added_by: actor.contributor_id,
    added_date: new Date().toISOString(),
    active_code: 'active',
  };
  writeUpsert_('project_comments', 'comment_id', row);
  touchProject_(project.project_id, actor.contributor_id);
  return row;
}

function addTaskComment_(body) {
  var actor = requireUser_(body);
  var task = findBy_(readSheet_('tasks'), 'task_id', body.taskId);
  if (!task || task.active_status === 'inactive') fail_('NOT_FOUND', 'That task no longer exists.');
  var row = {
    comment_id: Utilities.getUuid(),
    task_id: task.task_id,
    comment: requireText_(body.comment, 'Comment', 2000),
    added_by: actor.contributor_id,
    added_date: new Date().toISOString(),
    active_code: 'active',
  };
  writeUpsert_('task_comments', 'comment_id', row);
  task.updated_at = new Date().toISOString();
  task.version = bump_(task);
  writeUpsert_('tasks', 'task_id', task);
  return row;
}

function addPayment_(body) {
  var actor = requireUser_(body);
  var project = findBy_(readSheet_('projects'), 'project_id', body.projectId);
  if (!project || project.active_code === 'inactive') fail_('NOT_FOUND', 'That project no longer exists.');
  var row = {
    payment_id: Utilities.getUuid(),
    project_id: project.project_id,
    amount: amount_(body.amount, 'Amount', 0.01),
    date: optionalDate_(body.date || today_(), 'Payment date'),
    received_by: actor.contributor_id,
    voided: 'no',
    void_reason: '',
    voided_by: '',
    voided_at: '',
  };
  writeUpsert_('project_payments', 'payment_id', row);
  notify_('Payment received', actor.display_name + ' recorded ' + row.amount);
  recomputeBilling_(project.project_id);
  touchProject_(project.project_id, actor.contributor_id);
  return row;
}

function voidPayment_(body) {
  var actor = requireUser_(body);
  var payment = findBy_(readSheet_('project_payments'), 'payment_id', body.paymentId);
  if (!payment) fail_('NOT_FOUND', 'That payment no longer exists.');
  if (payment.voided === 'yes') return payment;
  var reason = requireText_(body.reason, 'Reason', 300);
  payment.voided = 'yes';
  payment.void_reason = reason;
  payment.voided_by = actor.contributor_id;
  payment.voided_at = new Date().toISOString();
  writeUpsert_('project_payments', 'payment_id', payment);
  recomputeBilling_(payment.project_id);
  touchProject_(payment.project_id, actor.contributor_id);
  return payment;
}

function setActive_(body) {
  var actor = requireUser_(body);
  var active = body.active !== false && body.active !== 'inactive';
  var flag = active ? 'active' : 'inactive';
  var sheet = String(body.sheet || '');
  var spec = {
    projects: { id: 'project_id', flag: 'active_code' },
    tasks: { id: 'task_id', flag: 'active_status' },
    expenses: { id: 'expense_id', flag: 'active_code' },
  }[sheet];
  if (!spec) fail_('VALIDATION', 'That record cannot be deleted.');
  var row = findBy_(readSheet_(sheet), spec.id, body.id);
  if (!row) fail_('NOT_FOUND', 'That record no longer exists.');
  assertVersion_(row, body.expectedVersion);
  row[spec.flag] = flag;
  row.updated_at = new Date().toISOString();
  if (sheet === 'projects') row.last_updated_by = actor.contributor_id;
  row.version = bump_(row);
  writeUpsert_(sheet, spec.id, row);
  return { id: String(body.id), active: active };
}

function updateProfile_(body) {
  var actor = requireUser_(body);
  var fields = body.fields || {};
  actor.display_name = requireText_(fields.display_name || actor.display_name, 'Display name', 80);
  actor.email = optionalEmail_(fields.email != null ? fields.email : actor.email);
  actor.phone = optionalPhone_(fields.phone != null ? fields.phone : actor.phone);
  var nextPassword = String(body.newPassword || '');
  if (nextPassword) {
    if (nextPassword.length < 8) fail_('VALIDATION', 'Password must be at least 8 characters.');
    actor.password_hash = hashPassword_(nextPassword);
  }
  actor.updated_at = new Date().toISOString();
  writeUpsert_('contributors', 'contributor_id', actor);
  return publicUser_(actor);
}

function savePushToken_(body) {
  var actor = requireUser_(body);
  var token = String(body.push_token || '');
  if (token && token.indexOf('ExponentPushToken') !== 0) {
    fail_('VALIDATION', 'Unrecognised push token.');
  }
  actor.push_token = token;
  actor.updated_at = new Date().toISOString();
  writeUpsert_('contributors', 'contributor_id', actor);
  return { ok: true };
}

function syncPeople_(kind, parentId, rawIds) {
  if (!rawIds || !rawIds.length) fail_('VALIDATION', 'Choose at least one person.');
  var seen = {};
  var ids = [];
  for (var i = 0; i < rawIds.length; i++) {
    var id = String(rawIds[i] || '').trim();
    if (!id || seen[id]) continue;
    seen[id] = true;
    var person = findBy_(readSheet_('contributors'), 'contributor_id', id);
    if (!person || person.active_code !== 'active') fail_('VALIDATION', 'Choose people from the team.');
    ids.push(id);
  }
  if (!ids.length) fail_('VALIDATION', 'Choose at least one person.');
  var sheet = kind === 'project' ? 'project_contributors' : 'expense_contributors';
  var parentKey = kind === 'project' ? 'project_id' : 'expense_id';
  var rows = readSheet_(sheet);
  var wanted = {};
  ids.forEach(function (id) { wanted[id] = true; });
  rows.forEach(function (row) {
    if (String(row[parentKey]) !== String(parentId)) return;
    row.active_status = wanted[row.contributor_id] ? 'active' : 'inactive';
    delete wanted[row.contributor_id];
    writeUpsert_(sheet, 'id', row);
  });
  Object.keys(wanted).forEach(function (contributorId) {
    var created = { id: Utilities.getUuid(), contributor_id: contributorId, active_status: 'active' };
    created[parentKey] = parentId;
    writeUpsert_(sheet, 'id', created);
  });
}

function setProjectGst_(projectId, gst) {
  var billing = findBy_(readSheet_('project_billing'), 'project_id', projectId);
  if (!billing) {
    writeUpsert_('project_billing', 'billing_id', {
      billing_id: Utilities.getUuid(),
      project_id: projectId,
      quoted_amount: 0,
      final_amount: 0,
      received_amount: 0,
      pending_amount: 0,
      gst_included: gst,
      version: 1,
    });
    return;
  }
  billing.gst_included = gst;
  billing.version = bump_(billing);
  writeUpsert_('project_billing', 'billing_id', billing);
}

function addSettlement_(body) {
  var actor = requireUser_(body);
  var fromId = String(body.fromId || '');
  var toId = String(body.toId || '');
  if (!fromId || !toId || fromId === toId) fail_('VALIDATION', 'Choose two different people.');
  var from = findBy_(readSheet_('contributors'), 'contributor_id', fromId);
  var to = findBy_(readSheet_('contributors'), 'contributor_id', toId);
  if (!from || from.active_code !== 'active' || !to || to.active_code !== 'active') {
    fail_('VALIDATION', 'Choose people from the team.');
  }
  var projectId = String(body.projectId || '');
  var expenseId = String(body.expenseId || '');
  if (projectId && expenseId) fail_('VALIDATION', 'Link a project or an expense, not both.');
  if (projectId) {
    var project = findBy_(readSheet_('projects'), 'project_id', projectId);
    if (!project || project.active_code === 'inactive') fail_('NOT_FOUND', 'That project no longer exists.');
  }
  if (expenseId) {
    var expense = findBy_(readSheet_('expenses'), 'expense_id', expenseId);
    if (!expense || expense.active_code === 'inactive') fail_('NOT_FOUND', 'That expense no longer exists.');
  }
  var row = {
    settlement_id: Utilities.getUuid(),
    from_contributor_id: fromId,
    to_contributor_id: toId,
    amount: amount_(body.amount, 'Amount', 0.01),
    date: optionalDate_(body.date || today_(), 'Date'),
    project_id: projectId,
    expense_id: expenseId,
    note: optionalText_(body.note, 'Note', 300),
    created_by: actor.contributor_id,
    created_at: new Date().toISOString(),
    voided: 'no',
    void_reason: '',
  };
  writeUpsert_('settlements', 'settlement_id', row);
  return row;
}

function voidSettlement_(body) {
  requireUser_(body);
  var row = findBy_(readSheet_('settlements'), 'settlement_id', body.settlementId);
  if (!row) fail_('NOT_FOUND', 'That transfer no longer exists.');
  if (row.voided === 'yes') return row;
  row.voided = 'yes';
  row.void_reason = requireText_(body.reason, 'Reason', 300);
  writeUpsert_('settlements', 'settlement_id', row);
  return row;
}

function recomputeBilling_(projectId) {
  var billing = findBy_(readSheet_('project_billing'), 'project_id', projectId);
  if (!billing) return;
  var payments = readSheet_('project_payments');
  var received = 0;
  var any = false;
  for (var i = 0; i < payments.length; i++) {
    if (String(payments[i].project_id) !== String(projectId)) continue;
    any = true;
    if (payments[i].voided === 'yes') continue;
    var n = Number(payments[i].amount);
    if (isFinite(n) && n > 0) received += Math.round(n * 100);
  }
  received = received / 100;
  if (!any) received = Number(billing.received_amount || 0) || 0;
  var finalAmount = Number(billing.final_amount || 0) || 0;
  var quoted = Number(billing.quoted_amount || 0) || 0;
  var billed = finalAmount > 0 ? finalAmount : quoted;
  billing.received_amount = received;
  billing.pending_amount = Math.max(0, Math.round((billed - received) * 100) / 100);
  billing.version = bump_(billing);
  writeUpsert_('project_billing', 'billing_id', billing);
}

function touchProject_(projectId, actorId) {
  var project = findBy_(readSheet_('projects'), 'project_id', projectId);
  if (!project) return;
  project.updated_at = new Date().toISOString();
  project.last_updated_by = actorId;
  project.version = bump_(project);
  writeUpsert_('projects', 'project_id', project);
}

function requireUser_(body) {
  var token = String(body.token || '');
  if (!token) fail_('AUTH_EXPIRED', 'Please sign in again.');
  var sessions = readSheet_('sessions');
  var hash = sha256_(token);
  var session = null;
  for (var i = 0; i < sessions.length; i++) {
    if (String(sessions[i].token_hash) === hash) session = sessions[i];
  }
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    fail_('AUTH_EXPIRED', 'Your session expired. Please sign in again.');
  }
  var user = findBy_(readSheet_('contributors'), 'contributor_id', session.contributor_id);
  if (!user || user.active_code !== 'active') fail_('AUTH_EXPIRED', 'This account is no longer active.');
  return user;
}

function publicUser_(user) {
  return {
    contributor_id: user.contributor_id,
    display_name: user.display_name,
    username: user.username,
    email: user.email,
    phone: String(user.phone || ''),
    active_code: user.active_code === 'inactive' ? 'inactive' : 'active',
    updated_at: user.updated_at || '',
  };
}

function findBy_(rows, key, id) {
  if (id === undefined || id === null || id === '') return null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][key]) === String(id)) return rows[i];
  }
  return null;
}

function versionOf_(row) {
  if (!row) return 0;
  var n = Number(row.version || 0);
  return isFinite(n) && n > 0 ? n : 0;
}

function bump_(row) {
  var current = versionOf_(row);
  return current > 0 ? current + 1 : 1;
}

function assertVersion_(row, expected) {
  var current = versionOf_(row);
  if (current === 0) return;
  if (Number(expected || 0) !== current) {
    fail_('CONFLICT', 'Someone else changed this. It has been reloaded — review and try again.');
  }
}

function requireText_(value, label, max) {
  var text = String(value == null ? '' : value).trim();
  if (!text) fail_('VALIDATION', label + ' is required.');
  if (text.length > max) fail_('VALIDATION', label + ' must be ' + max + ' characters or fewer.');
  return text;
}

function optionalText_(value, label, max) {
  var text = String(value == null ? '' : value).trim();
  if (text.length > max) fail_('VALIDATION', label + ' must be ' + max + ' characters or fewer.');
  return text;
}

function optionalDate_(value, label) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return '';
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) fail_('VALIDATION', label + ' must be a date like 2026-10-17.');
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail_('VALIDATION', label + ' is not a real date.');
  }
  return text;
}

function optionalEmail_(value) {
  var text = optionalText_(value, 'Email', 200);
  if (!text) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) fail_('VALIDATION', 'Email does not look valid.');
  return text;
}

function optionalPhone_(value) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return '';
  if (!/^[0-9+\-\s()]{8,20}$/.test(text)) {
    fail_('VALIDATION', 'Phone must be 8–20 digits (spaces and + are fine).');
  }
  return text;
}

function amount_(value, label, min, fallback) {
  var text = String(value == null ? '' : value).trim().replace(/,/g, '');
  if (text === '') {
    if (fallback !== undefined && fallback !== null && fallback !== '') return Number(fallback) || 0;
    fail_('VALIDATION', label + ' is required.');
  }
  var n = Number(text);
  if (!isFinite(n)) fail_('VALIDATION', label + ' must be a number.');
  if (n < min) fail_('VALIDATION', label + ' must be ' + min + ' or more.');
  return Math.round(n * 100) / 100;
}

function oneOf_(value, label, allowed, fallback) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return fallback;
  for (var i = 0; i < allowed.length; i++) {
    if (allowed[i] === text) return text;
  }
  fail_('VALIDATION', label + ' must be one of: ' + allowed.join(', ') + '.');
}

function today_() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
}

function passwordMatches_(stored, password) {
  if (stored.indexOf('v2$') === 0) {
    var parts = stored.split('$');
    if (parts.length < 3) return false;
    return sha256_(parts[1] + ':' + password) === parts[2];
  }
  return sha256_('calicon:' + password) === stored;
}

function hashPassword_(password) {
  var salt = Utilities.getUuid();
  return 'v2$' + salt + '$' + sha256_(salt + ':' + password);
}

function sha256_(value) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var v = (raw[i] < 0 ? raw[i] + 256 : raw[i]).toString(16);
    hex += (v.length === 1 ? '0' : '') + v;
  }
  return hex;
}

function readIdempotency_(key) {
  var rows = readSheet_('idempotency');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].key) === key) {
      try {
        return JSON.parse(rows[i].result_json);
      } catch (err) {
        return null;
      }
    }
  }
  return null;
}

function writeIdempotency_(key, result) {
  writeUpsert_('idempotency', 'key', { key: key, result_json: JSON.stringify(result) });
}

function spreadsheet_() {
  var active = SpreadsheetApp.getActive();
  if (active) return active;
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    fail_(
      'SERVER',
      'Cannot open the spreadsheet. If it is an Excel file, use File → Save as Google Sheets, open Extensions → Apps Script from that new file, and run setupWorkbook again. ' +
        err,
    );
  }
}

function readSheet_(name) {
  var sh = spreadsheet_().getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (!values.length || values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var blank = true;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = cell_(values[r][c]);
      if (obj[headers[c]] !== '' && obj[headers[c]] !== null) blank = false;
    }
    if (!blank && obj[headers[0]]) out.push(obj);
  }
  return out;
}

function cell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return value;
}

function writeUpsert_(sheetName, idKey, row) {
  var sh = spreadsheet_().getSheetByName(sheetName);
  if (!sh) fail_('SERVER', 'Missing sheet ' + sheetName + '. Run setupWorkbook.');
  var values = sh.getDataRange().getValues();
  if (!values.length) {
    sh.appendRow(HEADERS[sheetName]);
    values = sh.getDataRange().getValues();
  }
  var headers = values[0].map(function (h) { return String(h || ''); });
  var idCol = headers.indexOf(idKey);
  if (idCol < 0) fail_('SERVER', 'Missing id column ' + idKey);
  var targetRow = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(row[idKey])) {
      targetRow = r + 1;
      break;
    }
  }
  var line = headers.map(function (h) {
    if (!h) return '';
    return row[h] !== undefined && row[h] !== null ? row[h] : '';
  });
  if (targetRow > 0) sh.getRange(targetRow, 1, 1, headers.length).setValues([line]);
  else sh.appendRow(line);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    fail_('TIMEOUT', 'Someone else is saving. Wait a moment and try again.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function notify_(title, body) {
  try {
    var users = readSheet_('contributors');
    var messages = [];
    for (var i = 0; i < users.length; i++) {
      var token = String(users[i].push_token || '');
      if (token.indexOf('ExponentPushToken') === 0) {
        messages.push({ to: token, sound: 'default', title: title, body: body });
      }
    }
    for (var c = 0; c < messages.length; c += 100) {
      UrlFetchApp.fetch('https://exp.host/--/api/v2/push/send', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(messages.slice(c, c + 100)),
        muteHttpExceptions: true,
      });
    }
  } catch (err) {
    // A failed push must not roll back the saved row.
  }
}

function fail_(code, message) {
  var error = new Error(message);
  error.code = code;
  throw error;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
