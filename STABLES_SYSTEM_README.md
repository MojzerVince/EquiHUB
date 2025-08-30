# Stable/Ranch Database System

## Overview

The EquiHUB app now includes a comprehensive stable/ranch management system that allows users to join existing stables or create new ones. This system facilitates community building and organization within the equestrian world.

## Features

### 1. Stable Registration During Sign-up

- **Optional Selection**: During registration, users can optionally join an existing stable
- **Multiple Join Methods**:
  - Browse popular stables
  - Search by name, location, or specialty
  - Use a join code provided by stable owners
- **Skip Option**: Users can skip stable selection and join one later

### 2. Stable Management

- **Create Stables**: Users can create their own stables/ranches
- **Join Stables**: Join public stables or use invitation codes
- **Leave Stables**: Members can leave stables (except owners)
- **Multiple Memberships**: Users can be members of multiple stables

### 3. Stable Features

- **Public/Private**: Stables can be public (searchable) or private (invitation-only)
- **Join Codes**: Easy-to-share codes for quick stable joining
- **Member Roles**: Owner, Admin, Instructor, Member
- **Capacity Management**: Set maximum member limits
- **Rich Information**: Description, location, specialties, facilities
- **Search & Discovery**: Full-text search with location and specialty filtering

## Database Schema

### Tables Created

1. **`stables`** - Main stable information
2. **`stable_members`** - User-stable relationships and roles
3. **`stable_invitations`** - Invitation management system
4. **`profiles`** - Extended with `stable_id` for primary stable

### Key Features

- **Row Level Security (RLS)** for data protection
- **Automatic member counting** with triggers
- **Full-text search** with tsvector indexing
- **Join code generation** with uniqueness checks
- **Cascade deletions** for data integrity

## API Endpoints (StableAPI Class)

### Search & Discovery

- `searchStables()` - Search stables with filters
- `getPopularStables()` - Get most popular stables
- `getStableByJoinCode()` - Find stable by join code
- `getCountriesWithStables()` - Get countries for filtering
- `getStatesForCountry()` - Get states/provinces for filtering

### Stable Management

- `createStable()` - Create a new stable
- `updateStable()` - Update stable information
- `getStable()` - Get stable details

### Membership Management

- `joinStable()` - Join a stable by ID
- `joinStableByCode()` - Join using join code
- `leaveStable()` - Leave a stable
- `getUserStables()` - Get user's stable memberships

## User Interface Components

### 1. StableSelection Component

- **Modal interface** for stable selection
- **Three tabs**: Popular, Search, Join Code
- **Real-time search** with loading states
- **Responsive design** with proper error handling

### 2. Registration Integration

- **Optional step** in registration flow
- **Selected stable display** with change option
- **Join code input** with validation
- **Skip functionality** for later selection

### 3. Stable Management Screen

- **My Stables section** showing user's memberships
- **Popular Stables** for discovery
- **Role-based actions** (leave, manage)
- **Add stable button** for finding new stables

## Registration Flow Integration

### Authentication Updates

- Extended `RegisterData` interface with stable fields
- Updated registration metadata to include stable selection
- Database trigger handles automatic stable joining post-registration

### User Experience

1. User completes basic registration form
2. Optional stable selection step appears
3. User can browse, search, or use join code
4. User can skip and join stables later
5. Registration completes with automatic stable membership

## Security Features

### Row Level Security Policies

- **Stables**: Public viewing, owner/admin updates
- **Members**: Restricted to stable members
- **Invitations**: User-specific visibility

### Data Validation

- **Join code uniqueness** with collision detection
- **Member capacity limits** with validation
- **Role-based permissions** for all operations

## Sample Data

The system includes sample stables for testing:

- **Sunset Ridge Stables** (California) - Dressage, Jumping, Trails
- **Green Valley Ranch** (Texas) - Western, Ranch Work, Beginners
- **European Dressage Center** (Germany) - Professional Dressage

## Implementation Benefits

### For Users

- **Community Building**: Connect with local stables and riders
- **Easy Discovery**: Find stables by location and interests
- **Flexible Membership**: Join multiple stables as needed
- **Social Features**: Enhanced profile with stable affiliation

### For Stable Owners

- **Member Management**: Track and organize stable members
- **Marketing Tool**: Increased visibility for recruitment
- **Professional Presence**: Showcase facilities and specialties
- **Growth Tracking**: Monitor membership statistics

### For the Platform

- **User Engagement**: Increased app stickiness through community
- **Data Insights**: Understanding of equestrian demographics
- **Monetization Opportunities**: Premium stable features
- **Network Effects**: Stronger user base through connections

## Future Enhancements

### Planned Features

- **Stable-specific feeds** and announcements
- **Event management** within stables
- **Instructor scheduling** and lesson booking
- **Stable leaderboards** and competitions
- **Advanced member permissions** and custom roles
- **Payment integration** for stable fees
- **Stable verification** system for credibility

### Technical Improvements

- **Real-time notifications** for stable activities
- **Advanced search filters** (distance, ratings, price)
- **Map integration** for location-based discovery
- **Bulk member management** tools
- **Analytics dashboard** for stable owners

## Installation Instructions

1. **Run the database setup**:

   ```sql
   -- Execute STABLES_DATABASE_SETUP.sql in your Supabase SQL editor
   ```

2. **Import the API**:

   ```typescript
   import { StableAPI } from "../lib/stableAPI";
   ```

3. **Use the components**:

   ```typescript
   import StableSelection from "../components/StableSelection";
   ```

4. **Update registration**:
   - The registration flow is already updated
   - Users will see stable selection after completing basic info

## Support and Maintenance

### Monitoring

- **Member count accuracy** through trigger validation
- **Join code collision** detection and resolution
- **Search performance** optimization
- **User adoption** metrics tracking

### Data Management

- **Regular cleanup** of expired invitations
- **Stable verification** process for quality
- **Backup and recovery** procedures
- **Performance optimization** for large datasets

This stable system provides a solid foundation for community building within EquiHUB while maintaining flexibility for future enhancements and scaling.
