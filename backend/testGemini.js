import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function testModel(modelName) {
  try {
    console.log(`Testing model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const response = await model.generateContent("Say hello!");
    console.log(`[SUCCESS - ${modelName}]: ${response.response.text().trim()}`);
    return true;
  } catch (err) {
    console.log(`[FAILED - ${modelName}]:`, err.message);
    return false;
  }
}

async function run() {
  const models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  for (const m of models) {
    const ok = await testModel(m);
    if (ok) {
      console.log(`Model ${m} is working!`);
      break;
    }
  }
}

run();
