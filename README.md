# Wellenwerk Project

## Overview
This Project is focused on retrieving historical data of wellenwerks indoor rapid surf wave. The goal is to track slot availabilities as slots usually have a capacity of 12 people for a limited time (e.g. 60 minutes for an advanced session), which means that surfers try to book into sessions with less people. In order to get insights about the booking behavior of wellenwerk surfers, the availabilities are tracked. To do so wellenwerks booking api is fetched at regular intervals and the availability of each session is stored in a supabase database.
The historical data is then presented in a streamlit app.
The future goal of this project is to forecast the booking behaviour of wellenwerk customers. 

## Key Features
- **Session Management**: Each surf session is stored as a document containing start time, session type, and a list of available slots at various time points.
- **Dynamic Slot Updates**: New time points with updated availability are appended to a session document only when there is a change in availability, reducing unnecessary updates.
- **Cloud Functions**: A cloud function runs every minute to update the availability data, ensuring that the information stays up-to-date.
- **Database Integration**: The data is stored in a Supabase database, ensuring scalability and access to real-time data.
- **Cache Layer**: A caching mechanism is employed to store the results of the latest query, which is used to modify the database accordingly.

## Data Structure
### Session Document
A session document contains the following fields:
- `id` (String): Unique identifier for a specific session.
- `session_id` (String): Unique identifier for a session type.
- `session_type` (String): The type of session (e.g., Intermediat Surf Session, Trainingssession (Advanced/Pro)).
- `start_time` (Datetime): The start time of the session.
- `end_time` (Datetime): The end time of the session.
- `availability` (JSONB): A JSONB document with multiple entries. Each entry contains:
    - `timestamp` (Datetime): The exact time point for which availability is recorded.
    - `available_slots` (Integer): The number of available slots at that time point.

### Cache
The cache stores the most recent availability data to avoid repeated database queries. It is updated with each query and flushed periodically to ensure data consistency.

## Usage
The Wellenwerk Project is accessible via the following URL:
https://wellenwerk.streamlit.app
Use this link to view and interact with the session data in real-time. The dashboard allows you to check availability for different sessions and times.