
//
// https://learn.microsoft.com/en-us/azure/ai-services/openai/chatgpt-quickstart
//
// XXX
// "observability-openai" is the Azure "resource" here.
// There is a concept of "Model deployment" separate from the model name, but
// they confusingly default to each other in the client usage.
//
// AZURE_OPENAI_ENDPOINT=https://observability-openai.openai.azure.com \
//     OPENAI_API_VERSION=2024-08-01-preview \
//     MODEL=gpt-4o-mini \
//     node tmp-chat-azure.js


const {AzureOpenAI} = require('openai');

const MODEL = process.env.MODEL || 'gpt-4o-mini';

async function main() {
    const client = new AzureOpenAI({
        // Could use this instead of OPENAI_API_VERSION envvar above:
        // apiVersion: '2024-08-01-preview'
    });
    const chatCompletion = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: 'user',
                content: 'Answer in up to 3 words: Which ocean contains the falkland islands?',
            },
        ]
    });
    console.log(chatCompletion.choices[0].message.content);
}

main();
