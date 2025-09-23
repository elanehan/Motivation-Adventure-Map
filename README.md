# Motivation Adventure Map

A gamified job search dashboard where you conquer quests, defeat bosses, and level up your career journey—all visualized on a vibrant fantasy map.
![Demo of Adventure Map](screenshot-1.png)
![Screenshot](screenshot-2.png)

## Features
- Upload your own quests via CSV
- Track progress and XP
- Defeat weekly bosses for big rewards
- Claim daily, weekly, and monthly milestones
- Interactive 3D map powered by Three.js
- Export and restore your quest log

## Getting Started
1. Clone this repo:
	```sh
	git clone https://github.com/elanehan/Motivation-Adventure-Map.git
	```
2. Open `index.html` in your browser.
3. Use the setup section to load sample data, import your own quests, or restore a backup.

## CSV Format
To import new quests, use a CSV file with the following format:
```
Region, Task, Is_Boss
Forest, Solve 2 Easy LeetCode Problems, FALSE
Mountains, Design URL Shortener System, TRUE
```

## Tech Stack
- HTML, CSS, JavaScript
- Three.js for 3D map

## License
MIT

---