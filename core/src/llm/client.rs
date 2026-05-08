use async_trait::async_trait;
use serde::Deserialize;

#[async_trait]
pub trait LlmClient {
    async fn list_models(&self) -> Result<Vec<String>, crate::AppError>;
    async fn complete(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<String, crate::AppError>;
}

pub enum LlmProvider {
    Ollama,
    LmStudio,
}

pub struct UniversalClient {
    pub provider: LlmProvider,
    pub endpoint: String,
    pub model: String,
}

impl UniversalClient {
    pub fn new(provider: LlmProvider, endpoint: String, model: String) -> Self {
        Self {
            provider,
            endpoint,
            model,
        }
    }

    fn normalized_endpoint(&self) -> &str {
        self.endpoint.trim_end_matches('/')
    }
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Deserialize)]
struct OllamaGenerateResponse {
    response: String,
}

#[derive(serde::Serialize)]
struct OllamaGenerateRequest<'a> {
    model: &'a str,
    system: &'a str,
    prompt: &'a str,
    stream: bool,
}

#[derive(Deserialize)]
struct LmStudioModelsResponse {
    data: Vec<LmStudioModel>,
}

#[derive(Deserialize)]
struct LmStudioModel {
    id: String,
}

#[derive(serde::Serialize)]
struct LmStudioChatRequest<'a> {
    model: &'a str,
    messages: [LmStudioMessage<'a>; 2],
    stream: bool,
}

#[derive(serde::Serialize)]
struct LmStudioMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct LmStudioChatResponse {
    choices: Vec<LmStudioChoice>,
}

#[derive(Deserialize)]
struct LmStudioChoice {
    message: LmStudioChoiceMessage,
}

#[derive(Deserialize)]
struct LmStudioChoiceMessage {
    content: String,
}

#[async_trait]
impl LlmClient for UniversalClient {
    async fn list_models(&self) -> Result<Vec<String>, crate::AppError> {
        let http = reqwest::Client::new();
        match self.provider {
            LlmProvider::Ollama => {
                let url = format!("{}/api/tags", self.normalized_endpoint());
                let response = http
                    .get(url)
                    .send()
                    .await
                    .map_err(|err| format!("Failed calling Ollama tags endpoint: {err}"))?;

                let status = response.status();
                if !status.is_success() {
                    let body = response
                        .text()
                        .await
                        .map_err(|err| format!("Failed reading Ollama tags error body: {err}"))?;
                    return Err(format!("Ollama tags request failed ({status}): {body}"));
                }

                let parsed: OllamaTagsResponse = response
                    .json()
                    .await
                    .map_err(|err| format!("Failed parsing Ollama tags response: {err}"))?;
                Ok(parsed.models.into_iter().map(|model| model.name).collect())
            }
            LlmProvider::LmStudio => {
                let url = format!("{}/v1/models", self.normalized_endpoint());
                let response =
                    http.get(url).send().await.map_err(|err| {
                        format!("Failed calling LM Studio models endpoint: {err}")
                    })?;

                let status = response.status();
                if !status.is_success() {
                    let body = response.text().await.map_err(|err| {
                        format!("Failed reading LM Studio models error body: {err}")
                    })?;
                    return Err(format!(
                        "LM Studio models request failed ({status}): {body}"
                    ));
                }

                let parsed: LmStudioModelsResponse = response
                    .json()
                    .await
                    .map_err(|err| format!("Failed parsing LM Studio models response: {err}"))?;
                Ok(parsed.data.into_iter().map(|model| model.id).collect())
            }
        }
    }

    async fn complete(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<String, crate::AppError> {
        let http = reqwest::Client::new();
        match self.provider {
            LlmProvider::Ollama => {
                let url = format!("{}/api/generate", self.normalized_endpoint());
                let payload = OllamaGenerateRequest {
                    model: &self.model,
                    system: system_prompt,
                    prompt: user_prompt,
                    stream: false,
                };

                let response = http
                    .post(url)
                    .json(&payload)
                    .send()
                    .await
                    .map_err(|err| format!("Failed calling Ollama generate endpoint: {err}"))?;

                let status = response.status();
                if !status.is_success() {
                    let body = response.text().await.map_err(|err| {
                        format!("Failed reading Ollama generate error body: {err}")
                    })?;
                    return Err(format!("Ollama generate request failed ({status}): {body}"));
                }

                let parsed: OllamaGenerateResponse = response
                    .json()
                    .await
                    .map_err(|err| format!("Failed parsing Ollama generate response: {err}"))?;
                Ok(parsed.response)
            }
            LlmProvider::LmStudio => {
                let url = format!("{}/v1/chat/completions", self.normalized_endpoint());
                let payload = LmStudioChatRequest {
                    model: &self.model,
                    messages: [
                        LmStudioMessage {
                            role: "system",
                            content: system_prompt,
                        },
                        LmStudioMessage {
                            role: "user",
                            content: user_prompt,
                        },
                    ],
                    stream: false,
                };

                let response = http
                    .post(url)
                    .json(&payload)
                    .send()
                    .await
                    .map_err(|err| format!("Failed calling LM Studio chat endpoint: {err}"))?;

                let status = response.status();
                if !status.is_success() {
                    let body = response.text().await.map_err(|err| {
                        format!("Failed reading LM Studio chat error body: {err}")
                    })?;
                    return Err(format!("LM Studio chat request failed ({status}): {body}"));
                }

                let parsed: LmStudioChatResponse = response
                    .json()
                    .await
                    .map_err(|err| format!("Failed parsing LM Studio chat response: {err}"))?;
                let first = parsed
                    .choices
                    .into_iter()
                    .next()
                    .ok_or_else(|| "LM Studio returned no chat choices".to_string())?;
                Ok(first.message.content)
            }
        }
    }
}
