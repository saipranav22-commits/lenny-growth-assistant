import { createAgentSession, SessionManager, ModelRuntime, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

async function main() {
    try {
        const path = await import('path');
        const modelRuntime = await ModelRuntime.create({
            modelsPath: path.join(process.cwd(), '.pi', 'models.json')
        });
        await modelRuntime.setRuntimeApiKey("openai", "dummy");
        
        // Find Qwen 3 1.7b
        const model = await modelRuntime.getModel("openai", "qwen3:1.7b");
        
        if (!model) {
            console.error("Model openai/qwen3:1.7b not found!");
            process.exit(1);
        }
        
        const resourceLoader = new DefaultResourceLoader({
            cwd: process.cwd(),
            agentDir: path.join(process.cwd(), '.pi'),
            extensionFactories: [
                (pi) => {
                    pi.registerTool({
                        name: "get_project_status",
                        label: "Get Project Status",
                        description: "Gets the project status.",
                        parameters: {
                            type: "object",
                            properties: {},
                            required: []
                        },
                        execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
                            console.log("\n[Tool Invoked] get_project_status called!");
                            return {
                                content: [{ type: "text", text: "Project status is ALL GREEN. Tests passed." }],
                                details: {}
                            };
                        }
                    });
                }
            ]
        });
        
        await resourceLoader.reload();
        
        const { session } = await createAgentSession({
            model: model,
            tools: ["get_project_status"], 
            resourceLoader,
            sessionManager: SessionManager.inMemory()
        });

        session.subscribe((event) => {
            if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
                process.stdout.write(event.assistantMessageEvent.delta);
            }
        });

        console.log("Sending prompt to Pi...");
        await session.prompt("What is the project status? Use the get_project_status tool.");
        console.log("\nFinished!");
        
        session.dispose();
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

main();
