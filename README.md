# NeuroLingo Chrome Extension

A Chrome extension built with the [Neuro Game SDK API](https://github.com/VedalAI/neuro-game-sdk/tree/main) that enables Neuro interaction with Duolingo. This extension allows Neuro to automatically detect and answer Duolingo questions through intelligent web scraping and automated actions.

## Features

- **Modular Architecture**: Clean, maintainable codebase split into specialized modules
- **Enhanced WebSocket Communication**: Robust connection with Neuro API including heartbeat system  
- **Advanced Logging System**: Color-coded real-time logging with persistent popup caching (200 entries)
- **Intelligent Question Detection**: Supports multiple Duolingo question types with context extraction
- **Smart Answer Flow**: Automatic answer submission with force-continue functionality
- **Previous Answer Clearing**: Prevents interference between questions
- **Connection Resilience**: Automatic reconnection with exponential backoff
- **Persistent Log Caching**: Logs remain available even when popup is closed

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Navigate to [Duolingo](https://www.duolingo.com) and start a lesson
6. Open the extension popup to monitor activity and connection status

## Extension Architecture

### Modular Structure

The extension follows a clean modular architecture with separation of concerns:

- **manifest.json**: Extension configuration and permissions
- **src/background-main.js**: Main background service coordinator with integrated PopupManager
- **src/neuro-connection.js**: WebSocket connection management with Neuro API
- **src/message-handler.js**: Message processing and routing logic
- **src/logger.js**: Centralized logging system with popup integration
- **src/popup-manager.js**: Popup state management and log caching system
- **src/config.js**: Configuration constants and settings
- **src/main.js**: Content script coordinator and DOM observation
- **src/actions.js**: Duolingo action handlers and question processing
- **src/context-extractor.js**: Question context detection and extraction
- **src/dom-utils.js**: DOM manipulation utilities
- **view/popup.html**: Real-time monitoring interface with enhanced logging
- **src/popup.js**: New popup script integrated with PopupManager protocol
- **view/content.css**: Minimal styling for UI elements

### WebSocket Connection Management

The extension maintains a persistent WebSocket connection to the Neuro API with several resilience features:

- **Heartbeat System**: Sends periodic `ping` packets to keep the connection alive (required due to Chrome extension WebSocket limitations as referenced [here](https://groups.google.com/g/mongoose-users/c/EWQ_UgB6hsI?pli=1))
- **Automatic Reconnection**: Exponential backoff strategy for connection failures
- **Connection Health Monitoring**: Real-time status updates in popup interface

### Data Flow

1. **Question Detection**: Content script observes DOM mutations to detect new Duolingo questions
2. **Context Extraction**: Question text, type, available options, and tokens are intelligently extracted
3. **Context Transmission**: Question context is sent to Neuro via WebSocket through background script
4. **AI Processing**: Neuro processes the context and determines the appropriate action
5. **Action Execution**: Actions are received and executed on the Duolingo page with proper error handling
6. **Answer Submission**: Selected answers are submitted with automatic previous answer clearing
7. **Flow Control**: Extension forces Neuro to continue to next question using `actions/force` command
8. **Result Reporting**: Action results and status updates are sent back to Neuro

## Supported Actions

| Action Name | Description | Parameters | Return Value |
|-------------|-------------|------------|--------------|
| `submit_answer` | Submit an answer to the current question | `answer`: String containing the answer text | Success/failure with details |
| `get_question_context` | Retrieve detailed information about current question | None | Question context object |
| `continue_lesson` | Continue to next screen/question if available | None | Success/failure status |

### Action Flow Control

The extension implements intelligent flow control to ensure smooth question progression:

- **Answer Cooldown**: 3-second delay after answer submission before sending new context
- **Force Continue**: Uses Neuro Game SDK's `actions/force` command to prompt continuation
- **Previous Answer Clearing**: Automatically clears previous selections before new answers

## Supported Question Types

- **Multiple Choice (`choice`)**: Questions with predefined answer options that can be selected
- **Tap Challenges (`tap`)**: Token-based questions where you select words in the correct order
- **Text Input (`text`)**: Questions requiring typing a complete answer
- **Listen Challenges**: Audio-based questions (handled as tap challenges)

### Smart Answer Matching

The extension uses flexible text matching to handle Duolingo's dynamic content:
- **Fuzzy Matching**: Uses `includes()` and `startsWith()` for robust option selection
- **Text Normalization**: Handles extra characters, numbers, and formatting in options
- **Previous Selection Clearing**: Automatically deselects previous answers before new selections

## Enhanced Logging System

The extension features a comprehensive logging system with persistent caching visible in the popup interface:

### PopupManager Features
- **Persistent Cache**: Stores up to 200 log entries that survive popup closure
- **Real-time Streaming**: Live log updates when popup is open
- **Cached Log Replay**: Historical logs shown when popup reopens
- **Port-based Communication**: Efficient message passing between background and popup
- **Status Tracking**: Connection states, last events, and activity monitoring

### Log Levels
- **Info (Blue)**: Normal operations, question detection, successful actions
- **Warning (Orange)**: Non-critical issues, missing elements, retries
- **Error (Red)**: Failed actions, connection issues, parsing errors  
- **Debug (Gray Italic)**: Detailed debugging information, internal state changes

### Real-time Monitoring
- Connection status with Neuro API
- Question context detection and changes
- Action execution results and timing
- WebSocket heartbeat and reconnection events
- Answer submission tracking
- Cached log indicators for historical entries

## Development

### Adding New Question Types

To support additional Duolingo question types:

1. **Update Context Extractor**: Modify `extractQuestionContext()` in `src/context-extractor.js`
2. **Add Action Handling**: Update the switch statement in `src/actions.js` 
3. **Test DOM Selectors**: Verify selectors work with the new question type
4. **Update Documentation**: Add the new type to this README

### Extending Action Handlers

To add new actions that Neuro can perform:

1. **Register Action**: Add to actions array in `src/actions.js`
2. **Implement Handler**: Create handler function following existing patterns
3. **Add Message Routing**: Update switch statement in `src/main.js`
4. **Test Integration**: Verify action works end-to-end with Neuro

## Configuration

### WebSocket Settings
- **Default URL**: `ws://localhost:8000` (configurable in `src/config.js`)
- **Heartbeat Interval**: 15 seconds (prevents connection closure)
- **Reconnection Strategy**: Exponential backoff with maximum 60-second intervals
- **Max Reconnection Attempts**: 5 before showing disconnection notification

### Timing Configuration
- **Context Debounce**: 1 second delay between context messages
- **Context Change Threshold**: 5 seconds between similar context sends
- **Answer Cooldown**: 3 seconds after answer submission before new context
- **Action Registration Threshold**: 10 seconds between action registrations

## Troubleshooting

### Common Issues

**Connection Problems**
- Verify Neuro API server is running at the configured WebSocket URL
- Check Chrome developer console for WebSocket errors
- Monitor popup logs for connection status and reconnection attempts

**Question Detection Issues**
- Refresh the Duolingo page to reinitialize content scripts
- Check if new question types require updated DOM selectors
- Verify popup shows "Question detected" logs when starting lessons

**Answer Submission Failures**
- Ensure answer format matches expected question type
- Check popup error logs for specific failure reasons
- Verify submit button is found after answer selection

**Extension Not Loading**
- Confirm all files are present in the `src/` directory
- Check Chrome extensions page for error messages
- Reload the extension after any code changes

### Debug Tools

- **Popup Interface**: Real-time logging and connection status
- **Chrome DevTools**: Console logs and network monitoring  
- **Background Script Logs**: Service worker console in Chrome extensions page
- **Content Script Logs**: Available in Duolingo page console

## Architecture Benefits

### Modularity
- **Separation of Concerns**: Each module handles specific functionality
- **Easy Maintenance**: Changes isolated to relevant modules
- **Testability**: Individual components can be tested independently

### Reliability  
- **Robust Error Handling**: Graceful degradation and recovery
- **Connection Resilience**: Automatic reconnection with user feedback
- **State Management**: Proper tracking of extension and connection state

### Performance
- **Efficient DOM Observation**: Debounced mutation observers
- **Smart Context Detection**: Avoids duplicate context sends
- **Optimized Message Passing**: Structured communication protocols

## Future Enhancements

- **Enhanced Question Support**: Additional Duolingo question types and formats
- **Performance Monitoring**: Detailed timing and performance metrics
- **User Preferences**: Configurable timeouts and behavior settings
- **Lesson Analytics**: Statistics and progress tracking
- **Multi-language Support**: Broader Duolingo language compatibility
- **Advanced Error Recovery**: More sophisticated failure handling strategies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing modular architecture
4. Test thoroughly with various Duolingo question types
5. Update documentation as needed
6. Submit a pull request

## License

This project is built using the [Neuro Game SDK API](https://github.com/VedalAI/neuro-game-sdk/tree/main) and follows its licensing terms.
