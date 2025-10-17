/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import {
  LiveConnectConfig,
  Modality,
  LiveServerToolCall,
  GoogleGenAI,
} from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useLogStore, useSettings, useUI } from '@/lib/state';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;

  volume: number;

  generateText: (prompt: string) => Promise<string>;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model } = useSettings();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);
  const { setQuantumModeActive } = useUI();

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});

  // When the client instance changes (e.g. model change), disconnect the old one.
  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    client.disconnect();
    await client.connect(config);
  }, [client, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
    setQuantumModeActive(false);
  }, [setConnected, client, setQuantumModeActive]);

  const generateText = useCallback(
    async (prompt: string): Promise<string> => {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        return response.text;
      } catch (e) {
        console.error('Error generating text:', e);
        return 'An error occurred while trying to generate a response.';
      }
    },
    [apiKey],
  );

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
      setQuantumModeActive(false);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    const onInputTranscription = (text: string, isFinal: boolean) => {
      if (!isFinal) return;

      const command = text.toLowerCase().trim().replace(/[.,?]/g, '');
      const originalText = text.trim();

      const addLog = (text: string) => {
        useLogStore.getState().addTurn({ role: 'system', text, isFinal: true });
      };

      const rememberPrefixes = [
        'remember this',
        'make a note',
        '이것을 기억해', // "remember this"
        '메모해 둬', // "make a note of it"
      ];

      for (const prefix of rememberPrefixes) {
        if (originalText.toLowerCase().startsWith(prefix)) {
          let contentToRemember = originalText.substring(prefix.length).trim();
          if (contentToRemember.startsWith(':')) {
            contentToRemember = contentToRemember.substring(1).trim();
          }

          if (contentToRemember) {
            useSettings.getState().appendToCoreMemory(contentToRemember);
            addLog(`Added to Core Memory: "${contentToRemember}"`);
            return; // Command handled, exit early
          }
        }
      }

      const openSettingsCommands = ['open settings', 'show settings'];
      const closeSettingsCommands = ['close settings', 'hide settings'];
      const startCommands = ['start stream', 'connect', 'start connection'];
      const stopCommands = ['stop stream', 'disconnect', 'end connection', 'stop'];
      const recallCommands = [
        'what did i say',
        'what did i just say',
        'unable to recall what i stated',
        'repeat that',
      ];

      const { isSidebarOpen, toggleSidebar } = useUI.getState();

      if (openSettingsCommands.includes(command)) {
        if (!isSidebarOpen) {
          toggleSidebar();
          addLog(`Voice command recognized: "${command}"`);
        }
      } else if (closeSettingsCommands.includes(command)) {
        if (isSidebarOpen) {
          toggleSidebar();
          addLog(`Voice command recognized: "${command}"`);
        }
      } else if (startCommands.includes(command)) {
        if (!connected) {
          connect();
          addLog(`Voice command recognized: "${command}"`);
        }
      } else if (stopCommands.includes(command)) {
        if (connected) {
          disconnect();
          addLog(`Voice command recognized: "${command}"`);
        }
      } else if (recallCommands.includes(command)) {
        addLog(`Voice command recognized: "${command}"`);
        const { turns } = useLogStore.getState();
        const lastUserTurn = [...turns]
          .reverse()
          .find(turn => turn.role === 'user' && turn.isFinal);

        if (lastUserTurn) {
          addLog(`You said: "${lastUserTurn.text}"`);
        } else {
          addLog("I don't have a record of what you last said.");
        }
      }
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);
    client.on('inputTranscription', onInputTranscription);

    const onToolCall = (toolCall: LiveServerToolCall) => {
      const functionResponses: any[] = [];

      for (const fc of toolCall.functionCalls) {
        // Log the function call trigger
        const triggerMessage = `Triggering function call: **${
          fc.name
        }**\n\`\`\`json\n${JSON.stringify(fc.args, null, 2)}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: triggerMessage,
          isFinal: true,
        });

        // Prepare the response
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result: 'ok' }, // simple, hard-coded function response
        });
      }

      // Log the function call response
      if (functionResponses.length > 0) {
        const responseMessage = `Function call response:\n\`\`\`json\n${JSON.stringify(
          functionResponses,
          null,
          2,
        )}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: responseMessage,
          isFinal: true,
        });
      }

      client.sendToolResponse({ functionResponses: functionResponses });
    };

    client.on('toolcall', onToolCall);

    return () => {
      // Clean up event listeners
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('toolcall', onToolCall);
      client.off('inputTranscription', onInputTranscription);
    };
  }, [client, connected, connect, disconnect, setQuantumModeActive]);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    volume,
    generateText,
  };
}