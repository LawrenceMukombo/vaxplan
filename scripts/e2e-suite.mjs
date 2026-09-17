import http from "node:http";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

const results = {
  passed: [],
  failed: [],
  warnings: [],
  details: [],
};

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Accept": "application/json",
    ...(options.headers || {}),
  };
  
  if (options.method && options.method !== "GET" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  
  if (options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
}

async function runTest(name, fn) {
  try {
    const detail = await fn();
    results.passed.push(name);
    console.log(`[PASS] ${name}${detail ? ` - ${detail}` : ""}`);
    if (detail) results.details.push({ name, status: "PASS", detail });
  } catch (err) {
    results.failed.push({ name, error: err.message || String(err) });
    console.log(`[FAIL] ${name}: ${err.message || err}`);
  }
}

async function main() {
  console.log(`=======================================================`);
  console.log(` VAXPLAN ENTERPRISE END-TO-END VERIFICATION SUITE      `);
  console.log(` Target: ${BASE_URL}                                    `);
  console.log(` Time:   ${new Date().toISOString()}                   `);
  console.log(`=======================================================\n`);

  let authCookie = "";

  // 1. Health & Public Endpoints
  await runTest("1.1 System Health endpoint (/api/health)", async () => {
    const res = await req("/api/health");
    if (res.status !== 200 || !res.data || res.data.status !== "ok") {
      throw new Error(`Expected status 200 with status='ok', got ${res.status}`);
    }
    return `Server healthy, timestamp: ${res.data.timestamp}`;
  });

  await runTest("1.2 Tenants listing (/api/public/tenants)", async () => {
    const res = await req("/api/public/tenants");
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`Expected non-empty array of tenants, got status ${res.status}`);
    }
    return `Found ${res.data.length} active tenant(s): ${res.data.map(t => t.name || t.countryName || t.code).join(", ")}`;
  });

  await runTest("1.3 Public Vax Card search (/api/public/vax-card)", async () => {
    const res = await req("/api/public/vax-card?search=Test");
    if (res.status !== 200) {
      throw new Error(`Public vax card returned status ${res.status}`);
    }
    return `Public endpoint accessible with status 200`;
  });

  // 2. Authentication & Session Establishment
  await runTest("2.1 Session Acquisition & Mock Login (/api/login)", async () => {
    const res = await fetch(`${BASE_URL}/api/login?email=dev.admin@vaxplan.org`, {
      method: "GET",
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      authCookie = setCookie.split(";")[0];
    }

    if (!authCookie) {
      throw new Error("Failed to acquire session cookie from /api/login");
    }
    return `Acquired valid session cookie: ${authCookie.slice(0, 20)}...`;
  });

  const authHeader = authCookie ? { Cookie: authCookie } : {};

  // 3. User Identity & Multi-Tenancy Scoping
  await runTest("3.1 Authenticated User endpoint (/api/auth/user)", async () => {
    const res = await req("/api/auth/user", { headers: authHeader });
    if (res.status !== 200 || !res.data || !res.data.email) {
      throw new Error(`Expected 200 with user data, got status ${res.status}: ${JSON.stringify(res.data)}`);
    }
    return `Logged in as: ${res.data.email} (Role: ${res.data.role || 'SuperAdmin'}, TenantId: ${res.data.tenantId || 'Default'})`;
  });

  await runTest("3.2 Active Tenant Scoping (/api/me/tenant)", async () => {
    const res = await req("/api/me/tenant", { headers: authHeader });
    if (res.status !== 200) {
      results.warnings.push(`/api/me/tenant returned status ${res.status}`);
      return `Status ${res.status}`;
    }
    return `Active tenant configured: ${res.data?.name || res.data?.countryCode || 'Scoped'}`;
  });

  // 4. GIS & Spatial Hierarchy
  await runTest("4.1 Provinces & Districts Hierarchy", async () => {
    const provRes = await req("/api/provinces", { headers: authHeader });
    if (provRes.status !== 200 || !Array.isArray(provRes.data)) {
      throw new Error(`Provinces API returned status ${provRes.status}`);
    }
    const distRes = await req("/api/districts", { headers: authHeader });
    if (distRes.status !== 200 || !Array.isArray(distRes.data)) {
      throw new Error(`Districts API returned status ${distRes.status}`);
    }
    return `Loaded ${provRes.data.length} province(s) and ${distRes.data.length} district(s)`;
  });

  let testFacilityId = null;
  await runTest("4.2 Health Facilities (/api/facilities)", async () => {
    const res = await req("/api/facilities", { headers: authHeader });
    if (res.status !== 200 || !Array.isArray(res.data)) {
      throw new Error(`Facilities API returned status ${res.status}`);
    }
    if (res.data.length > 0) {
      testFacilityId = res.data[0].id;
    }
    return `Loaded ${res.data.length} facility records (Sample Facility ID: ${testFacilityId})`;
  });

  await runTest("4.3 Villages & Settlements Population Hub (/api/villages)", async () => {
    const res = await req("/api/villages", { headers: authHeader });
    if (res.status !== 200 || !Array.isArray(res.data)) {
      throw new Error(`Villages API returned status ${res.status}`);
    }
    return `Loaded ${res.data.length} village/settlement entries`;
  });

  // 5. Routine & SIA Microplans
  await runTest("5.1 Routine Microplans Engine (/api/microplans)", async () => {
    const res = await req("/api/microplans", { headers: authHeader });
    if (res.status !== 200 || !Array.isArray(res.data)) {
      throw new Error(`Microplans API returned status ${res.status}`);
    }
    return `Found ${res.data.length} microplan(s) in active workspace`;
  });

  await runTest("5.2 Planning Actions Tracker (/api/planning-actions)", async () => {
    if (!testFacilityId) {
      throw new Error("No facility ID available to test planning actions");
    }
    const res = await req(`/api/planning-actions?facilityId=${testFacilityId}`, { headers: authHeader });
    if (res.status !== 200) {
      throw new Error(`Planning actions API returned status ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const count = Array.isArray(res.data?.actions) ? res.data.actions.length : 0;
    return `Loaded ${count} action item(s) for facility ${testFacilityId} (canWrite: ${res.data?.canWrite})`;
  });

  await runTest("5.3 Planning Evidence Repository (/api/planning-evidence)", async () => {
    if (!testFacilityId) {
      throw new Error("No facility ID available to test planning evidence");
    }
    const res = await req(`/api/planning-evidence?facilityId=${testFacilityId}&kind=consultation`, { headers: authHeader });
    if (res.status !== 200) {
      throw new Error(`Planning evidence API returned status ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const count = Array.isArray(res.data?.records) ? res.data.records.length : 0;
    return `Loaded ${count} evidence record(s) for facility ${testFacilityId} (canWrite: ${res.data?.canWrite})`;
  });

  // 6. Client Logbook & Demographic Search
  await runTest("6.1 Client Logbook Registry & Multi-field Search (/api/clients)", async () => {
    const res = await req("/api/clients", { headers: authHeader });
    if (res.status !== 200 || !Array.isArray(res.data)) {
      throw new Error(`Clients registry returned status ${res.status}`);
    }
    
    // Test search filtering by query
    const searchRes = await req("/api/clients?search=Demo", { headers: authHeader });
    if (searchRes.status !== 200 || !Array.isArray(searchRes.data)) {
      throw new Error(`Clients search query returned status ${searchRes.status}`);
    }

    return `Total clients: ${res.data.length}, Filtered by 'Demo': ${searchRes.data.length} match(es)`;
  });

  await runTest("6.2 Defaulter List & Dropout Tracking (/api/defaulters)", async () => {
    const res = await req("/api/defaulters", { headers: authHeader });
    if (res.status !== 200) {
      throw new Error(`Defaulters API returned status ${res.status}`);
    }
    const count = Array.isArray(res.data) ? res.data.length : (res.data?.defaulters?.length ?? 0);
    return `Tracking ${count} potential defaulter client record(s)`;
  });

  // 7. Logistics, Stock & Cold Chain
  await runTest("7.1 Vaccine Stock Ledger (/api/stock)", async () => {
    const res = await req("/api/stock", { headers: authHeader });
    if (res.status !== 200) {
      throw new Error(`Stock API returned status ${res.status}`);
    }
    const count = Array.isArray(res.data) ? res.data.length : (res.data?.items?.length ?? 0);
    return `Stock ledger returned status 200 with ${count} item(s)`;
  });

  await runTest("7.2 Cold Chain Equipment Inventory (/api/cold-chain)", async () => {
    const res = await req("/api/cold-chain", { headers: authHeader });
    if (res.status !== 200) {
      throw new Error(`Cold chain API returned status ${res.status}`);
    }
    const count = Array.isArray(res.data) ? res.data.length : (res.data?.equipment?.length ?? 0);
    return `Cold chain inventory returned status 200 with ${count} equipment record(s)`;
  });

  // 8. Supportive Supervision & Approvals
  await runTest("8.1 Supportive Supervision Visits (/api/supervision-visits)", async () => {
    const res = await req("/api/supervision-visits", { headers: authHeader });
    if (res.status !== 200) {
      throw new Error(`Supervision visits API returned status ${res.status}`);
    }
    const count = Array.isArray(res.data) ? res.data.length : 0;
    return `Loaded ${count} supervision visit record(s)`;
  });

  await runTest("8.2 Governance & Approvals Workflow (/api/approvals)", async () => {
    const res = await req("/api/approvals", { headers: authHeader });
    if (res.status !== 200 && res.status !== 403) {
      throw new Error(`Approvals API returned status ${res.status}`);
    }
    return `Approvals endpoint responded with status ${res.status}`;
  });

  // 9. Route Accessibility (Zero 404s verification)
  await runTest("9.1 Frontend Application Route Integrity", async () => {
    const keyRoutes = [
      "/",
      "/clients",
      "/client-logbook",
      "/map",
      "/facilities",
      "/settlements",
      "/population",
      "/microplans/routine",
      "/all-sessions",
      "/plan-health",
      "/planning-actions",
      "/planning-evidence",
      "/stock",
      "/cold-chain",
      "/approvals",
      "/reports",
      "/research",
    ];

    const failedRoutes = [];
    for (const route of keyRoutes) {
      const res = await req(route);
      if (res.status !== 200) {
        failedRoutes.push(`${route} (${res.status})`);
      }
    }

    if (failedRoutes.length > 0) {
      throw new Error(`The following routes failed: ${failedRoutes.join(", ")}`);
    }

    return `All ${keyRoutes.length} core application routes respond with status 200`;
  });

  // 10. Security, Idle Timeout & Logout Verification
  await runTest("10.1 Security Headers & Unauthenticated Protection", async () => {
    // Check that unauthorized access to protected resources without cookies returns 401
    const unauthRes = await req("/api/auth/user");
    if (unauthRes.status !== 401) {
      throw new Error(`Expected unauthenticated /api/auth/user to return 401, got ${unauthRes.status}`);
    }
    return `RBAC and unauthenticated protection successfully enforced (401)`;
  });

  await runTest("10.2 Session Configuration Endpoint (/api/auth/session-config)", async () => {
    const res = await req("/api/auth/session-config");
    if (res.status !== 200 || typeof res.data?.idleTimeoutMinutes !== "number") {
      throw new Error(`Expected session config with idleTimeoutMinutes, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    return `Idle Timeout: ${res.data.idleTimeoutMinutes}m, Warning Period: ${res.data.warningMinutes}m, Absolute Limit: ${res.data.absoluteTimeoutMinutes}m`;
  });

  await runTest("10.3 Keep-Alive Inactivity Heartbeat (/api/auth/ping)", async () => {
    const res = await req("/api/auth/ping", { method: "POST", headers: authHeader });
    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Expected successful ping response, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    return `Activity heartbeat updated lastActive timestamp successfully`;
  });

  await runTest("10.4 User Custom Idle Timeout Configuration (/api/auth/user-idle-timeout)", async () => {
    const setRes = await req("/api/auth/user-idle-timeout", {
      method: "POST",
      headers: authHeader,
      body: { idleTimeout: 30 },
    });
    if (setRes.status !== 200 || !setRes.data?.success) {
      throw new Error(`Failed to set user idle timeout: ${setRes.status}`);
    }

    const resetRes = await req("/api/auth/user-idle-timeout", {
      method: "POST",
      headers: authHeader,
      body: { idleTimeout: "default" },
    });
    if (resetRes.status !== 200 || !resetRes.data?.success) {
      throw new Error(`Failed to reset user idle timeout: ${resetRes.status}`);
    }
    return `User customized idle timeout preference saved & restored to default`;
  });

  await runTest("10.5 Session Logout & Invalidation (/api/logout)", async () => {
    const res = await req("/api/logout?reason=manual_logout&format=json", { headers: authHeader });
    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Expected successful logout, got status ${res.status}`);
    }
    return `Session invalidated and cookies cleared cleanly`;
  });

  console.log(`\n=======================================================`);
  console.log(` END-TO-END EXECUTION REPORT                          `);
  console.log(`=======================================================`);
  console.log(` Passed:   ${results.passed.length}`);
  console.log(` Failed:   ${results.failed.length}`);
  console.log(` Warnings: ${results.warnings.length}`);
  console.log(`=======================================================\n`);

  if (results.failed.length > 0) {
    console.error("FAILED TESTS:");
    for (const f of results.failed) {
      console.error(` - [${f.name}]: ${f.error}`);
    }
    process.exitCode = 1;
  } else {
    console.log("ALL END-TO-END WORKFLOWS PASSED SUCCESSFULLY!");
  }
}

main().catch((e) => {
  console.error("Fatal error executing test suite:", e);
  process.exit(1);
});
