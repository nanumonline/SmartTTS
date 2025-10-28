import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Radio, Plus } from "lucide-react";

const schedules = [
  {
    id: 1,
    title: "오전 공지사항",
    time: "09:00",
    days: ["월", "화", "수", "목", "금"],
    status: "active",
  },
  {
    id: 2,
    title: "점심시간 안내",
    time: "12:00",
    days: ["월", "화", "수", "목", "금"],
    status: "active",
  },
  {
    id: 3,
    title: "퇴근 안내",
    time: "18:00",
    days: ["월", "화", "수", "목", "금"],
    status: "active",
  },
];

const ScheduleManager = () => {
  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-5xl font-bold">
            <span className="gradient-text">방송 스케줄</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            자동 송출 일정을 관리하고 모니터링하세요
          </p>
        </div>

        <div className="space-y-6">
          {/* Add Schedule Button */}
          <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-center py-12">
              <Button variant="outline" size="lg">
                <Plus className="w-5 h-5" />
                새 스케줄 추가
              </Button>
            </CardContent>
          </Card>

          {/* Schedule List */}
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-primary" />
                      {schedule.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {schedule.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {schedule.days.join(", ")}
                      </span>
                    </CardDescription>
                  </div>
                  <Badge variant={schedule.status === "active" ? "default" : "secondary"}>
                    {schedule.status === "active" ? "활성" : "비활성"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">편집</Button>
                  <Button variant="outline" size="sm">복제</Button>
                  <Button variant="outline" size="sm">삭제</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScheduleManager;
