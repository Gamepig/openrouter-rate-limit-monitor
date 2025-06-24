# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-06-24

### 🎉 Major Release - Complete Monitoring Solution

#### ✨ Added
- **Local Request Tracking**: Intelligent local tracking system that solves OpenRouter API limitation of not providing request count statistics
- **2025 Rate Limit Compliance**: Updated to reflect OpenRouter's current limits (20 requests/minute, 50/1000 requests/day based on credit balance)
- **Three Core Metrics**: Complete implementation of daily request count + credits usage + credits balance monitoring
- **RequestTracker Service**: New service for local request counting with daily/monthly statistics and model-based tracking
- **Enhanced Status Display**: Rich status information with local tracked data prioritized over API null values
- **Programmatic API**: Full programmatic interface for integrating monitoring into other applications

#### 🔧 Fixed
- **Watch Mode Null Display**: Fixed misleading `Daily: null/1000` display, now shows accurate `Daily: 8/1000` with local tracking
- **Rate Limit Data Structure**: Corrected rate limit calculations to use 2025 OpenRouter rules (20/minute instead of incorrect 150)
- **Daily Limit Logic**: Fixed daily limit calculation based on credit balance ($10+ gets 1000/day, otherwise 50/day)
- **Change Indicators**: Fixed change detection in watch mode to use correct data sources
- **Error Handling**: Enhanced 429 error handling with detailed limit explanations

#### 🚀 Improved
- **Display Logic Consistency**: Unified data display across status and watch modes
- **API Response Handling**: Better handling of OpenRouter API responses and null values
- **Configuration Updates**: Updated to reflect accurate OpenRouter API capabilities and limitations
- **User Experience**: Clearer messaging about API limitations and local tracking benefits

#### 📊 Data Structure Changes
- Added `localTracked` object to daily limits with `used`, `remaining`, `percentage`, `status`, `note`
- Enhanced rate limit objects with `hasRealTimeData`, `apiLimitation` fields
- Improved credit usage formatting with separate `total_credits`, `remaining_credits` fields

#### 🔧 Technical Improvements
- **HTTP Headers Parsing**: Added support for extracting rate limit information from response headers
- **Local Data Persistence**: Automatic daily request tracking with 30-day retention
- **Model-based Statistics**: Track usage by AI model for detailed analytics
- **Quota Management**: Real-time quota calculation and health status assessment

### Breaking Changes
- API response structure for daily limits now includes `localTracked` object
- Watch mode display format changed to show real request counts instead of null values
- Rate limit display now correctly shows 20/minute instead of previous incorrect values

### Migration Guide
- Existing installations will automatically start tracking requests locally from the first API call
- No configuration changes required - local tracking works out of the box
- Historical data will begin accumulating immediately

---

## [1.1.0] - 2025-06-23

### Added
- Enhanced credit display with total/used/remaining breakdown
- Integration with OpenRouter `/credits` API endpoint
- Improved error handling for API responses

### Fixed
- Credit calculation accuracy
- API key validation improvements

---

## [1.0.0] - 2025-06-22

### Added
- Initial release of OpenRouter Rate Limit Monitor
- Basic rate limit monitoring functionality
- CLI interface with status and watch commands
- API key management system
- Configuration management
- History tracking
- Cross-platform system notifications

### Features
- Real-time monitoring with configurable intervals
- Colored terminal output with professional tables
- JSON output support for automation
- Portable design for easy project integration
- Comprehensive error handling and logging