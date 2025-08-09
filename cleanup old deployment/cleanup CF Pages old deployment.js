// =================================================================
// Cloudflare 配置
// 警告：将 API 令牌硬编码在代码中存在严重安全风险。
// 建议使用 Cloudflare Secrets 来存储此令牌。
// =================================================================
const API_TOKEN = "";
const ACCOUNT_ID = "";
const PROJECT_NAME = "moontv";
const KEEP_DEPLOYMENTS = 3; // 保留最新的部署数量

// API 端点和请求头
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`;
const HEADERS = {
    "Authorization": `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
};

/**
 * 监听 Cloudflare 的定时触发器 (Cron Trigger)
 */
addEventListener('scheduled', event => {
    event.waitUntil(handleScheduled());
});

/**
 * 定时任务的主处理��数
 */
async function handleScheduled() {
    console.log("Starting cleanup of old deployments...");
    await cleanupOldDeployments();
    console.log("Cleanup task finished.");
}

/**
 * 获取所有部署列表
 * @returns {Promise<Array>} 部署对象数组
 */
async function listDeployments() {
    const deployments = [];
    let page = 1;
    const per_page = 25; // 每次请求获取的数量

    while (true) {
        const url = new URL(BASE_URL);
        url.searchParams.set("page", page);
        url.searchParams.set("per_page", per_page);

        try {
            const response = await fetch(url.toString(), { headers: HEADERS });
            const data = await response.json();

            if (!data.success) {
                console.error(`Failed to list deployments: ${JSON.stringify(data)}`);
                break;
            }

            const deploymentsPage = data.result;
            if (!deploymentsPage || deploymentsPage.length === 0) {
                // 如果当前页没有部署了，说明已经获取完毕
                break;
            }

            deployments.push(...deploymentsPage);
            page++;
        } catch (error) {
            console.error(`Error fetching deployments: ${error}`);
            break;
        }
    }
    return deployments;
}

/**
 * 删除指定的部署
 * @param {string} deploymentId - 要删除的部署 ID
 */
async function deleteDeployment(deploymentId) {
    const url = `${BASE_URL}/${deploymentId}`;
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: HEADERS
        });
        if (response.ok) {
            console.log(`Successfully deleted deployment: ${deploymentId}`);
        } else {
            const errorData = await response.json();
            console.error(`Failed to delete ${deploymentId}: ${JSON.stringify(errorData)}`);
        }
    } catch (error) {
        console.error(`Error deleting deployment ${deploymentId}: ${error}`);
    }
}

/**
 * 清理旧的部署
 */
async function cleanupOldDeployments() {
    const deployments = await listDeployments();
    
    // 按创建日期降序排序
    deployments.sort((a, b) => new Date(b.created_on) - new Date(a.created_on));

    const toDelete = deployments.slice(KEEP_DEPLOYMENTS);
    
    console.log(`Found ${deployments.length} deployments. Deleting ${toDelete.length} old ones...`);

    for (const deployment of toDelete) {
        // 我们只删除那些非生产环境的部署
        if (deployment.environment !== 'production') {
             await deleteDeployment(deployment.id);
        } else {
             console.log(`Skipping deletion of production deployment: ${deployment.id}`);
        }
    }
}