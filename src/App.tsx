import {useEffect, useState} from 'react'
import './App.css'
import {LLM} from "./LLM/LLM.ts";

function App() {
    const [llm, setLlm] = useState<LLM | null>(null);

    const handleGetModels = async () => {
        try {
            if (llm) {
                const models = await llm.getModels();
                console.log('Models:', models);
            }
        } catch (error) {
            console.error('Error fetching models:', error);
        }
    };

    const chatCompletion = async (req: string) => {
        try {
            if (llm) {
                const response = await llm.chatCompletion(req);
                console.log('response:', response);
            }
        } catch (error) {
            console.error('Error chatCompletion:', error);
        }
    }
    useEffect(() => {
        const initLLM = async () => {
            try {
                const clientId = import.meta.env.VITE_GIGACHAT_CLIENT_ID || 'YOUR_CLIENT_ID';
                const clientSecret = import.meta.env.VITE_GIGACHAT_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
                const baseURL = import.meta.env.VITE_BASE_URL || 'YOUR_CLIENT_SECRET';

                if (!clientId || !clientSecret || !baseURL) {
                    throw new Error('Не заданы Client ID или Client Secret или Base URL');
                }

                const instance = new LLM(clientId, clientSecret,baseURL);
                console.log("initLLM", instance);
                const isConnected = await instance.testConnection();
                if (!isConnected) {
                    throw new Error('Не удалось подключиться к GigaChat API');
                }

                setLlm(instance);
            } catch (err) {
                console.error('Ошибка:', err);
            }
        };

        initLLM();
    }, []);

  return (
    <>
     <button onClick={()=> handleGetModels()}> Получить модели</button>
     <button onClick={()=> chatCompletion('Напоминай сдавать отчёт каждый последний день месяца в 12:00 за неделю и за день')}> Тест расписания</button>
    </>
  )
}

export default App
