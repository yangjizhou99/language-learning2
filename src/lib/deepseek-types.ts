import OpenAI from "openai";

declare module "openai" {
  namespace OpenAI {
    interface ChatCompletionMessage {
      reasoning_content?: string;
    }
  }
}

export type DeepSeekChatCompletionMessage = OpenAI.ChatCompletionMessage & {
  reasoning_content?: string;
};
