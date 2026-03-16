# AgentHub Voice Features FAQ

## Quick Reference Guide

### 🎙️ Voice TTS (Text-to-Speech)

#### What is Voice TTS?
- Converts text alerts to spoken words using your computer's built-in voices
- Uses browser's `window.speechSynthesis` API (no internet required)
- Only for **critical priority** events by default

#### How to Enable Voice TTS:
1. Click the ⚙️ Settings icon in AgentHub
2. Find the "Notifications" section
3. Check "Voice TTS (critical only, off by default)"
4. Adjust volume with the slider (appears when enabled)
5. Click outside settings to save

#### How to Test Voice TTS:
1. Enable Voice TTS in settings
2. Trigger a critical priority event:
   - Agent enters error state
   - High-priority triage event occurs
   - Manual test via developer tools

#### How to Change the Voice:
Voice comes from your operating system:
- **macOS**: System Settings → Accessibility → Spoken Content
- **Windows**: Settings → Time & Language → Speech
- **Linux**: Depends on speech-dispatcher configuration

#### Troubleshooting Voice TTS:

**"No sound when voice should play"**
1. Check Voice TTS is enabled in settings
2. Verify system volume is not muted
3. Check browser has permission for audio
4. Test with `speechSynthesis.speak(new SpeechSynthesisUtterance('test'))` in browser console

**"Wrong voice/language"**
1. Change default voice in your OS settings
2. Restart browser after changing system voice
3. Some browsers require page refresh to detect new voices

**"Voice sounds robotic"**
- This is normal - uses system TTS voices
- For better quality, install additional voices in your OS

### 🔊 Sound Effects

#### What are Sound Effects?
- Short audio cues for notifications
- Different sounds for different priority levels
- Work alongside voice TTS

#### How to Enable/Disable:
1. Click ⚙️ Settings icon
2. Check/Uncheck "Sound alerts (high+ priority)"
3. Changes take effect immediately

#### Sound Priority Levels:
- **Critical**: Alarm sound (red alert)
- **High**: Chime sound (important but not urgent)
- **Medium**: Soft beep (informational)

### 🎤 Voice Input (/voice command)

#### Current Status:
- `/voice` command depends on Claude's feature rollout
- Currently available to only 5% of Claude users
- AgentHub is ready to pass the command when available

#### How It Will Work (When Available):
1. Type `/voice` in agent terminal
2. Press Enter
3. Claude will activate voice mode
4. Speak your commands/questions
5. Claude processes voice input

#### Alternative Voice Input Methods:
1. **System voice recognition**: Use OS-level dictation
2. **Browser extensions**: Voice-to-text extensions
3. **External tools**: Dragon NaturallySpeaking, etc.

### 🔧 Technical Details

#### Voice TTS Implementation:
- File: `src/renderer/src/services/voice-tts.ts`
- Uses: `window.speechSynthesis` API
- Format: "{agentName} in {repoName}: {reason}"
- Volume: Configurable (0.0 to 1.0, default 0.7)

#### Input Flow:
```
Terminal → terminal-manager.ts → IPC → agent-manager.ts → PTY → Claude Agent
```

#### Guards (when voice won't play):
1. Voice TTS disabled in settings
2. Agent terminal has focus (won't interrupt you)
3. Event is not critical priority
4. Browser doesn't support speechSynthesis

### 🚫 Known Limitations

1. **Voice TTS**:
   - Only works in browsers that support speechSynthesis
   - Voice quality depends on OS voices installed
   - No custom voice selection within AgentHub

2. **Voice Input**:
   - `/voice` command not available until Claude rollout
   - Requires microphone permissions
   - May not work in all browsers

3. **General**:
   - Voice features require page to be open (not just minimized)
   - Some browsers block autoplay of audio

### 💡 Pro Tips

1. **Use both sound + voice**: Sound for attention, voice for details
2. **Critical events only**: Voice won't spam you with minor alerts
3. **Volume balance**: Set voice volume lower than sound effects
4. **Test voices**: Try different system voices for best experience
5. **Browser choice**: Chrome/Edge have best speechSynthesis support

## Support

For issues with voice features:
1. Check browser console (F12) for errors
2. Verify OS voice settings
3. Test with simple `speechSynthesis` API calls
4. Ensure no browser extensions are blocking audio
