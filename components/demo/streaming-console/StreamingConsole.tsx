/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';
import PopUp from '../popup/PopUp';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
import {
  LiveConnectConfig,
  Modality,
  LiveServerContent,
  Part,
} from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  useTools,
  ConversationTurn,
} from '@/lib/state';

const formatTimestamp = (date: Date) => {
  const pad = (num: number, size = 2) => num.toString().padStart(size, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const milliseconds = pad(date.getMilliseconds(), 3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const renderContent = (text: string) => {
  // Split by ```json...``` code blocks
  const parts = text.split(/(`{3}json\n[\s\S]*?\n`{3})/g);

  return parts.map((part, index) => {
    if (part.startsWith('```json')) {
      const jsonContent = part.replace(/^`{3}json\n|`{3}$/g, '');
      return (
        <pre key={index}>
          <code>{jsonContent}</code>
        </pre>
      );
    }

    // Split by **bold** text
    const boldParts = part.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((boldPart, boldIndex) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return <strong key={boldIndex}>{boldPart.slice(2, -2)}</strong>;
      }
      return boldPart;
    });
  });
};

export default function StreamingConsole() {
  const { client, setConfig } = useLiveAPIContext();
  const { systemPrompt, voice, coreMemory } = useSettings();
  const { tools } = useTools();
  const { turns, addTurn, updateLastTurn } = useLogStore();
  const [showPopUp, setShowPopUp] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const config: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };

    const fullSystemInstruction = [
      systemPrompt,
      coreMemory ? `--- Core Memory ---\n${coreMemory}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (fullSystemInstruction) {
      config.systemInstruction = fullSystemInstruction;
    }

    const enabledTools = tools.filter(tool => tool.isEnabled);
    if (enabledTools.length > 0) {
      config.tools = [
        {
          functionDeclarations: enabledTools.map(
            ({ name, description, parameters, scheduling }) => ({
              name,
              description,
              parameters,
              scheduling,
            }),
          ),
        },
      ];
    }

    setConfig(config);
  }, [systemPrompt, voice, tools, setConfig, coreMemory]);

  useEffect(() => {
    const onInputTranscription = (text: string, isFinal: boolean) => {
      const currentTurns = useLogStore.getState().turns;
      const lastTurn =
        currentTurns.length > 0 ? currentTurns[currentTurns.length - 1] : null;

      if (lastTurn && lastTurn.role === 'user' && !lastTurn.isFinal) {
        updateLastTurn({ text: lastTurn.text + text, isFinal });
      } else {
        addTurn({ role: 'user', text, isFinal });
      }
    };

    const onOutputTranscription = (text: string, isFinal: boolean) => {
      const currentTurns = useLogStore.getState().turns;
      const lastTurn =
        currentTurns.length > 0 ? currentTurns[currentTurns.length - 1] : null;

      if (lastTurn && lastTurn.role === 'agent' && !lastTurn.isFinal) {
        updateLastTurn({ text: lastTurn.text + text, isFinal });
      } else {
        addTurn({ role: 'agent', text, isFinal });
      }
    };

    const onContent = (content: LiveServerContent) => {
      if (content.modelTurn) {
        const textContent = content.modelTurn.parts
          .map((part: Part) => ('text' in part ? part.text : ''))
          .join(' ');
        if (textContent) {
          addTurn({ role: 'agent', text: textContent, isFinal: true });
        }
      }
    };

    client.on('inputTranscription', onInputTranscription);
    client.on('outputTranscription', onOutputTranscription);
    client.on('content', onContent);

    return () => {
      client.off('inputTranscription', onInputTranscription);
      client.off('outputTranscription', onOutputTranscription);
      client.off('content', onContent);
    };
  }, [client, addTurn, updateLastTurn]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const hasTurns = turns.length > 0;

  return (
    <div className="streaming-console-inner" ref={scrollRef}>
      {showPopUp && <PopUp onClose={() => setShowPopUp(false)} />}
      {!hasTurns && !showPopUp && <WelcomeScreen />}
      {turns.map((turn, index) => (
        <div
          key={`${turn.role}-${turn.timestamp.toISOString()}-${index}`}
          className={`turn turn-${turn.role}`}
        >
          <div className="turn-header">
            <span className="role">{turn.role}</span>
            <span className="timestamp">{formatTimestamp(turn.timestamp)}</span>
          </div>
          <div className="turn-content">{renderContent(turn.text)}</div>
        </div>
      ))}
    </div>
  );
}