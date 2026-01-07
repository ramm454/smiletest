# agents/bi_agent.py
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64
from datetime import datetime, timedelta

class BusinessIntelligenceAgent:
    def __init__(self):
        self.db = DatabaseClient()
        
    async def generate_daily_report(self, date: datetime) -> Dict:
        """Generate comprehensive daily business report"""
        
        report = {
            "date": date.isoformat(),
            "summary": {},
            "metrics": {},
            "visualizations": {},
            "insights": [],
            "recommendations": []
        }
        
        # Collect metrics
        report["metrics"] = await self.collect_daily_metrics(date)
        
        # Compare with historical data
        report["trends"] = await self.analyze_trends(date, report["metrics"])
        
        # Generate visualizations
        report["visualizations"] = await self.create_visualizations(report["metrics"], report["trends"])
        
        # Generate AI-powered insights
        report["insights"] = await self.generate_insights(report["metrics"], report["trends"])
        
        # Create actionable recommendations
        report["recommendations"] = await self.create_recommendations(report["insights"])
        
        # Executive summary
        report["summary"] = await self.create_executive_summary(report)
        
        return report
    
    async def collect_daily_metrics(self, date: datetime) -> Dict:
        """Collect all business metrics for the day"""
        
        metrics = {
            "revenue": {
                "total": await self.db.get_daily_revenue(date),
                "by_service": await self.db.get_revenue_by_service(date),
                "by_channel": await self.db.get_revenue_by_channel(date)
            },
            "attendance": {
                "total": await self.db.get_daily_attendance(date),
                "by_class": await self.db.get_attendance_by_class(date),
                "no_show_rate": await self.db.get_no_show_rate(date)
            },
            "clients": {
                "new": await self.db.get_new_clients(date),
                "returning": await self.db.get_returning_clients(date),
                "churned": await self.db.get_churned_clients(date)
            },
            "operations": {
                "staff_utilization": await self.db.get_staff_utilization(date),
                "room_utilization": await self.db.get_room_utilization(date),
                "avg_service_time": await self.db.get_avg_service_time(date)
            },
            "marketing": {
                "conversion_rate": await self.db.get_conversion_rate(date),
                "cost_per_acquisition": await self.db.get_cpa(date),
                "customer_lifetime_value": await self.db.get_clv(date)
            }
        }
        
        return metrics
    
    async def generate_insights(self, metrics: Dict, trends: Dict) -> List[Dict]:
        """Generate AI-powered business insights"""
        
        insights = []
        
        # Revenue insights
        revenue_trend = trends.get("revenue", {}).get("trend", "stable")
        if revenue_trend == "decreasing" and metrics["revenue"]["total"] > 0:
            insights.append({
                "category": "revenue",
                "severity": "high",
                "insight": "Revenue shows decreasing trend. Last 7 days: ${:.2f} avg vs ${:.2f} today.".format(
                    trends["revenue"].get("weekly_avg", 0),
                    metrics["revenue"]["total"]
                ),
                "root_cause_analysis": await self.analyze_revenue_decline(metrics, trends)
            })
        
        # Client retention insights
        churn_rate = metrics["clients"].get("churn_rate", 0)
        if churn_rate > 0.1:  # 10% churn rate
            insights.append({
                "category": "retention",
                "severity": "high",
                "insight": "High churn rate detected: {:.1f}% of clients didn't return.".format(churn_rate * 100),
                "suggested_action": "Implement retention campaign for at-risk clients"
            })
        
        # Operational efficiency insights
        staff_util = metrics["operations"].get("staff_utilization", 0)
        if staff_util < 0.6:
            insights.append({
                "category": "operations",
                "severity": "medium",
                "insight": "Low staff utilization ({:.1f}%). Consider cross-training or schedule optimization.".format(staff_util * 100)
            })
        
        # Marketing effectiveness insights
        if metrics["marketing"].get("cost_per_acquisition", 0) > metrics["marketing"].get("customer_lifetime_value", 0) * 0.3:
            insights.append({
                "category": "marketing",
                "severity": "high",
                "insight": "Customer acquisition cost is high relative to lifetime value.",
                "recommendation": "Focus on retention and referral programs"
            })
        
        return insights
    
    async def create_visualizations(self, metrics: Dict, trends: Dict) -> Dict:
        """Create data visualizations"""
        
        visualizations = {}
        
        # Revenue trend chart
        revenue_data = trends.get("revenue", {}).get("history", [])
        if revenue_data:
            fig, ax = plt.subplots(figsize=(10, 6))
            dates = [r["date"] for r in revenue_data]
            values = [r["value"] for r in revenue_data]
            
            ax.plot(dates, values, marker='o')
            ax.set_title('7-Day Revenue Trend')
            ax.set_xlabel('Date')
            ax.set_ylabel('Revenue ($)')
            ax.grid(True, alpha=0.3)
            
            # Convert to base64 for web display
            buf = BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            visualizations["revenue_trend"] = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close()
        
        # Service popularity chart
        service_data = metrics["revenue"].get("by_service", {})
        if service_data:
            fig, ax = plt.subplots(figsize=(10, 6))
            services = list(service_data.keys())
            revenues = list(service_data.values())
            
            bars = ax.bar(services, revenues)
            ax.set_title('Revenue by Service')
            ax.set_xlabel('Service')
            ax.set_ylabel('Revenue ($)')
            plt.xticks(rotation=45, ha='right')
            
            # Add value labels
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                        f'${height:,.0f}', ha='center', va='bottom')
            
            buf = BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            visualizations["service_revenue"] = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close()
        
        return visualizations