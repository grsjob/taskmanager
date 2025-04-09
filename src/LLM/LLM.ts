import axios, {AxiosInstance, AxiosResponse} from 'axios';
import qs from 'qs';
import { v4 as uuidv4 } from 'uuid';

interface LLMToken {
    accessToken: string;
    expiresIn: number;
    tokenType: string;
}

interface LLMResponse {
    content: string;
    tokensUsed?: number;
}

export class LLM {
    private authAxios: AxiosInstance;
    private apiAxios: AxiosInstance;
    private token: LLMToken | null = null;
    private clientId: string;
    private clientSecret: string;

    constructor(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;

        // Инициализация отдельных инстансов для auth и api
        this.authAxios = axios.create({
            baseURL: '/auth-proxy', // Прокси для авторизации
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        this.apiAxios = axios.create({
            baseURL: '/api-proxy', // Прокси для API
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    private getAuthHeader(): string {
        return `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`;
    }

    async getToken(): Promise<LLMToken> {
        try {
            const response = await this.authAxios.post(
                '/api/v2/oauth',
                qs.stringify({ scope: 'GIGACHAT_API_PERS' }),
                {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'RqUID': uuidv4()
                    }
                }
            );

            this.token = {
                accessToken: response.data.access_token,
                expiresIn: response.data.expires_in,
                tokenType: response.data.token_type
            };

            return this.token;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.getToken();
            return true;
        } catch {
            return false;
        }
    }

    async getModels(): Promise<AxiosResponse> {
        await this.ensureToken();

        const response = await this.apiAxios.get(`/api/v1/models`, {
            headers: {
                'Authorization': `Bearer ${this.token!.accessToken}`
            }
        })

        return response.data
    }
    async chatCompletion(prompt: string): Promise<LLMResponse> {
        await this.ensureToken();

        const response = await this.apiAxios.post(
            '/api/v1/chat/completions',
            {
                model: "GigaChat",
                messages: [{
                    role: "system",
                    content: "Ты - интеллектуальный ассистент для управления задачами. Твоя задача - анализировать голосовые команды пользователя и преобразовывать их в структурированный JSON для системы управления задачами. \n" +
                        "\n" +
                        "### Требования:\n" +
                        "1. **Извлечение сущностей**:\n" +
                        "   - Даты (абсолютные: \"15 мая\", и относительные: \"через 3 дня\")\n" +
                        "   - Время (с точностью до минут)\n" +
                        "   - Периодичность (ежедневно, еженедельно по средам, первый четверг месяца)\n" +
                        "   - Категории (работа, личное, здоровье)\n" +
                        "   - Приоритет (1-5)\n" +
                        "   - Напоминания (за N дней/часов до события)\n" +
                        "\n" +
                        "2. **Обработка неявных данных**:\n" +
                        "   - Если дата не указана - считать \"сегодня\"\n" +
                        "   - Если время не указано - использовать \"12:00\"\n" +
                        "   - Автоматически определять категорию по контексту\n" +
                        "\n" +
                        "3. **Стандартизация формата**:\n" +
                        "   - Все даты в ISO 8601 (2024-05-15T14:00:00)\n" +
                        "   - Периодичность в формате RRULE (стандарт iCalendar)\n" +
                        "\n" +
                        "4. **Контроль качества**:\n" +
                        "   - Запрашивать уточнения при неоднозначности\n" +
                        "   - Предлагать 1-2 варианта интерпретации сложных запросов\n" +
                        "\n" +
                        "### Примеры интерпретации:\n" +
                        "1. \"Запланируй встречу с клиентом в кафе каждый второй понедельник в 15:00 с напоминанием за час\":\n" +
                        "   ```json\n" +
                        "   {\n" +
                        "     \"title\": \"Встреча с клиентом в кафе\",\n" +
                        "     \"datetime\": \"2024-05-13T15:00:00\",\n" +
                        "     \"rrule\": \"FREQ=MONTHLY;BYDAY=2MO\",\n" +
                        "     \"reminders\": [\"PT1H\"],\n" +
                        "     \"category\": \"work\",\n" +
                        "     \"priority\": 2\n" +
                        "   }."
                },{ role: "user", content: `Пользователь сказал: "${prompt}"

Преобразуй это в JSON-задачу со следующими полями:
1. \`title\` - краткое название (3-5 слов)
2. \`datetime\` - точная дата и время (ISO 8601)
3. \`rrule\` - периодичность (если есть)
4. \`reminders\` - массив напоминаний (ISO 8601 duration)
5. \`category\` - придумай категории под которую лучше подходит данная задача. Существует несколько основных категорий: работа, личное, здоровье. Если задача не подходит ни по одну из них  - придумай новую
6. \`priority\` - число от 1 (низкий) до 5 (критичный)
7. \`notes\` - дополнительные детали (если есть)

### Правила:
- Для относительных дат ("через 2 недели") вычисляй конкретную дату
- Для периодичности используй паттерны:
  - "каждый день" → \`FREQ=DAILY\`
  - "по вторникам" → \`FREQ=WEEKLY;BYDAY=TU\`
  - "первый четверг месяца" → \`FREQ=MONTHLY;BYDAY=1TH\`
- Напоминания указывай как интервалы до события:
  - "за 3 дня" → \`P3D\`
  - "за 2 часа" → \`PT2H\`

Верни ТОЛЬКО JSON без пояснений.` }],
                temperature: 0.7,
                max_tokens: 512
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.token!.accessToken}`
                }
            }
        );

        return {
            content: response.data.choices[0].message.content,
            tokensUsed: response.data.usage?.total_tokens
        };
    }

    private async ensureToken(): Promise<void> {
        if (!this.token || this.isTokenExpired()) {
            await this.getToken();
        }
    }

    private isTokenExpired(): boolean {
        if (!this.token) return true;
        // Добавьте логику проверки срока действия токена при необходимости
        return false;
    }

    private handleError(error: unknown): Error {
        if (axios.isAxiosError(error)) {
            const errorData = error.response?.data;
            return new Error(errorData?.error || error.message);
        }
        return new Error('Unknown error occurred');
    }
}