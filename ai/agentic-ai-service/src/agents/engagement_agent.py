# agents/engagement_agent.py
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np

class EngagementAgent:
    def __init__(self):
        self.db = DatabaseClient()
        
    async def analyze_client_behavior(self, user_id: str) -> Dict:
        """Analyze client data for personalized engagement"""
        
        # Get client data
        client_data = await self.db.get_client_data(user_id)
        
        # Cluster similar clients
        client_cluster = await self.cluster_clients(client_data)
        
        # Generate insights
        insights = {
            "engagement_pattern": await self.analyze_engagement_pattern(client_data),
            "preference_profile": await self.build_preference_profile(client_data),
            "churn_risk": await self.calculate_churn_risk(client_data, client_cluster),
            "next_best_action": await self.suggest_next_best_action(client_data)
        }
        
        return insights
    
    async def cluster_clients(self, client_data: Dict) -> int:
        """Cluster clients for segmentation"""
        
        # Prepare features for clustering
        features = await self.extract_clustering_features(client_data)
        
        # Scale features
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(features)
        
        # Apply K-means clustering
        kmeans = KMeans(n_clusters=5, random_state=42)
        cluster = kmeans.fit_predict([scaled_features])[0]
        
        return cluster
    
    async def suggest_next_best_action(self, client_data: Dict) -> Dict:
        """Suggest next best action for client engagement"""
        
        actions = []
        
        # Check last visit
        days_since_last_visit = await self.get_days_since_last_visit(client_data)
        
        if days_since_last_visit > 30:
            actions.append({
                "type": "re_engagement",
                "action": "Send personalized comeback offer",
                "priority": "high",
                "message_template": f"We miss you! Here's 20% off your next {client_data['favorite_service']} session."
            })
        
        # Check preferences for new services
        if await self.has_untried_preferences(client_data):
            actions.append({
                "type": "service_expansion",
                "action": "Suggest new service based on preferences",
                "priority": "medium",
                "message_template": "Based on your interest in yoga, you might enjoy our new Vinyasa Flow class!"
            })
        
        # Check for special occasions
        if await self.is_special_occasion(client_data):
            actions.append({
                "type": "special_offer",
                "action": "Send occasion-based offer",
                "priority": "medium",
                "message_template": "Happy birthday! Enjoy a complimentary spa treatment this month."
            })
        
        return {"actions": actions, "priority_order": sorted(actions, key=lambda x: x["priority"])}
    
    async def personalize_communication(self, user_id: str, message_type: str, 
                                      template: str) -> str:
        """Personalize communication based on user profile"""
        
        profile = await self.db.get_user_profile(user_id)
        
        # Replace template variables
        personalized = template
        
        if "{name}" in personalized:
            personalized = personalized.replace("{name}", profile.get("first_name", "there"))
        
        if "{favorite_service}" in personalized:
            personalized = personalized.replace(
                "{favorite_service}", 
                profile.get("favorite_service", "yoga class")
            )
        
        if "{last_visit}" in personalized:
            last_visit = await self.get_last_visit_date(user_id)
            if last_visit:
                personalized = personalized.replace(
                    "{last_visit}",
                    f"your last visit on {last_visit.strftime('%B %d')}"
                )
        
        # Add AI-generated personal touch
        personal_touch = await self.generate_personal_touch(user_id, message_type)
        personalized += f"\n\n{personal_touch}"
        
        return personalized