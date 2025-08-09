// 保存为 vercel-cleanup.js

export default {
  /**
   * @param {ScheduledController} controller
   * @param {object} env
   * @param {ExecutionContext} ctx
   */
  async scheduled(controller, env, ctx) {
    // 确保所有必要的环境变量都已设置
    const { VERCEL_TOKEN, PROJECT_ID, KEEP_DEPLOYMENTS } = env;
    if (!VERCEL_TOKEN || !PROJECT_ID || !KEEP_DEPLOYMENTS) {
      console.error("Missing required environment variables: VERCEL_TOKEN, PROJECT_ID, and KEEP_DEPLOYMENTS must be set.");
      return;
    }

    console.log(`Starting Vercel cleanup for project: ${PROJECT_ID}...`);
    ctx.waitUntil(cleanupVercelDeployments(env));
  },
};

/**
 * 清理旧的 Vercel 部署
 * @param {object} env - 环境变量
 */
async function cleanupVercelDeployments(env) {
  const { VERCEL_TOKEN, PROJECT_ID, KEEP_DEPLOYMENTS, TEAM_ID } = env;
  
  const allDeployments = await listAllDeployments(PROJECT_ID, VERCEL_TOKEN, TEAM_ID);

  // 按创建时间降序排列，最新的在最前面
  allDeployments.sort((a, b) => b.createdAt - a.createdAt);

  // 找到当前正在生效的生产部署，这个部署绝对不能删除
  const currentProductionDeployment = allDeployments.find(d => d.target === 'production');
  const currentProductionId = currentProductionDeployment ? currentProductionDeployment.uid : null;

  if (currentProductionId) {
    console.log(`Identified current production deployment: ${currentProductionId}. It will be protected from deletion.`);
  } else {
    console.log("No active production deployment found. Cleanup will proceed on other deployments.");
  }

  // 筛选出可以被删除的部署
  const deletableDeployments = allDeployments.filter(d => {
    // 必须是 READY 状态
    if (d.state !== 'READY') {
      return false;
    }
    // 绝对不能是当前生效的生产部署
    if (d.uid === currentProductionId) {
      return false;
    }
    // 其他所有部署（包括旧的生产部署）都可以被删除
    return true;
  });

  // 确定要删除的部署
  const toDelete = deletableDeployments.slice(parseInt(KEEP_DEPLOYMENTS, 10));
  
  console.log(`Found ${allDeployments.length} total deployments.`);
  console.log(`Found ${deletableDeployments.length} deletable deployments (including old production ones).`);
  console.log(`Keeping ${KEEP_DEPLOYMENTS} recent deployments, deleting ${toDelete.length} old ones.`);

  if (toDelete.length === 0) {
    console.log("No old deployments to delete.");
    return;
  }

  // 并行删除所有旧的部署
  const deletePromises = toDelete.map(deployment => 
    deleteDeployment(deployment.uid, VERCEL_TOKEN, TEAM_ID)
  );

  await Promise.all(deletePromises);
  console.log("Vercel cleanup complete.");
}

/**
 * 获取一个项目的所有部署
 * @param {string} projectId
 * @param {string} token
 * @param {string|undefined} teamId
 * @returns {Promise<Array>}
 */
async function listAllDeployments(projectId, token, teamId) {
  const headers = { "Authorization": `Bearer ${token}` };
  let allDeployments = [];
  let nextTimestamp = null;

  while (true) {
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("projectId", projectId);
    if (teamId) url.searchParams.set("teamId", teamId);
    if (nextTimestamp) url.searchParams.set("until", nextTimestamp);

    const response = await fetch(url.toString(), { headers });
    const data = await response.json();

    if (!response.ok) {
      console.error(`Failed to list Vercel deployments: ${JSON.stringify(data.error)}`);
      break;
    }

    allDeployments.push(...data.deployments);

    if (data.pagination && data.pagination.next) {
      nextTimestamp = data.pagination.next;
    } else {
      break;
    }
  }
  return allDeployments;
}

/**
 * 删除单个 Vercel 部署
 * @param {string} deploymentId
 * @param {string} token
 * @param {string|undefined} teamId
 */
async function deleteDeployment(deploymentId, token, teamId) {
  const url = new URL(`https://api.vercel.com/v13/deployments/${deploymentId}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  
  const headers = { "Authorization": `Bearer ${token}` };

  const response = await fetch(url.toString(), { method: 'DELETE', headers });

  if (response.ok) {
    console.log(`Successfully deleted Vercel deployment: ${deploymentId}`);
  } else {
    const errorData = await response.json();
    console.error(`Failed to delete ${deploymentId}: ${JSON.stringify(errorData.error)}`);
  }
}
