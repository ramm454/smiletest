# agents/orchestrator.py
from typing import Dict, List
import asyncio
from datetime import datetime
import json

class AIOrchestrator:
    def __init__(self):
        self.agents = {
            "booking": BookingAgent(),
            "engagement": EngagementAgent(),
            "pricing": PricingAgent(),
            "staff": StaffSchedulingAgent(),
            "voice": VoiceAgent(),
            "multichannel": MultiChannelAgent()
        }
        self.workflow_registry = {}
        
    async def execute_business_workflow(self, workflow_name: str, 
                                       input_data: Dict) -> Dict:
        """Execute complex business workflows using multiple agents"""
        
        workflows = {
            "new_client_onboarding": self.new_client_onboarding,
            "daily_operations_optimization": self.daily_operations_optimization,
            "monthly_business_review": self.monthly_business_review,
            "marketing_campaign_execution": self.marketing_campaign_execution
        }
        
        workflow = workflows.get(workflow_name)
        if not workflow:
            return {"error": f"Unknown workflow: {workflow_name}"}
        
        # Execute workflow
        result = await workflow(input_data)
        
        # Log execution
        await self.log_workflow_execution(workflow_name, input_data, result)
        
        return result
    
    async def new_client_onboarding(self, client_data: Dict) -> Dict:
        """Orchestrate new client onboarding workflow"""
        
        results = {}
        
        # Step 1: Create client profile
        results["profile_creation"] = await self.agents["engagement"].create_client_profile(
            client_data["user_id"]
        )
        
        # Step 2: Send welcome message via preferred channel
        results["welcome_message"] = await self.agents["multichannel"].send_welcome(
            client_data["user_id"],
            client_data.get("preferred_channel", "whatsapp")
        )
        
        # Step 3: Schedule introductory session
        results["intro_booking"] = await self.agents["booking"].schedule_intro_session(
            client_data["user_id"],
            client_data.get("preferences", {})
        )
        
        # Step 4: Set up follow-up reminders
        results["followup_setup"] = await self.setup_followup_system(client_data["user_id"])
        
        # Step 5: Add to engagement campaigns
        results["campaign_enrollment"] = await self.enroll_in_campaigns(client_data["user_id"])
        
        return results
    
    async def daily_operations_optimization(self, date: datetime) -> Dict:
        """Optimize daily operations"""
        
        results = {}
        
        # Parallel execution of optimization tasks
        tasks = [
            self.optimize_staff_schedule(date),
            self.adjust_dynamic_pricing(date),
            self.personalize_client_communications(date),
            self.analyze_real_time_metrics(date)
        ]
        
        # Execute in parallel
        optimization_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for i, result in enumerate(optimization_results):
            task_name = ["staff_schedule", "pricing", "communications", "metrics"][i]
            if isinstance(result, Exception):
                results[task_name] = {"error": str(result)}
            else:
                results[task_name] = result
        
        # Generate consolidated insights
        results["consolidated_insights"] = await self.generate_daily_insights(results)
        
        # Execute recommendations
        results["actions_taken"] = await self.execute_daily_actions(results["consolidated_insights"])
        
        return results
    
    async def generate_daily_insights(self, optimization_results: Dict) -> List[Dict]:
        """Generate business insights from optimization results"""
        
        insights = []
        
        # Staffing insights
        staff_utilization = optimization_results.get("staff_schedule", {}).get("utilization", 0)
        if staff_utilization < 0.6:
            insights.append({
                "type": "staffing",
                "priority": "high",
                "insight": "Staff utilization is low ({}%). Consider reducing staff or increasing marketing.".format(staff_utilization * 100),
                "recommendation": "Run promotion for off-peak hours"
            })
        
        # Pricing insights
        avg_discount = optimization_results.get("pricing", {}).get("avg_discount", 0)
        if avg_discount > 20:
            insights.append({
                "type": "pricing",
                "priority": "medium",
                "insight": "High average discount ({}%) may be affecting profitability.".format(avg_discount),
                "recommendation": "Review pricing strategy for underperforming services"
            })
        
        # Customer engagement insights
        response_rate = optimization_results.get("communications", {}).get("response_rate", 0)
        if response_rate < 0.3:
            insights.append({
                "type": "engagement",
                "priority": "high",
                "insight": "Low communication response rate ({}%). Messages may not be engaging enough.".format(response_rate * 100),
                "recommendation": "A/B test message content and timing"
            })
        
        return insights