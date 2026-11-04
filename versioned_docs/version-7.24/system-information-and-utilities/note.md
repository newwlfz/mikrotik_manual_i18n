---
sidebar_key: "system-information-and-utilities/note"
sidebar_position: 9
title: "Note"
source: https://manual.mikrotik.com/docs/7.24/system-information-and-utilities/note
captured_at: '2026-11-04T11:33:34+08:00'
---

### Summary

**Sub-menu:** `/system/note`

The system note feature allows you to assign arbitrary text notes or messages that will be displayed on each login right after the banner. For example, you may distribute warnings between system administrators this way, or describe what that particular router actually does. To configure the system note, you may upload a plain text file named **sys-note.txt** on the router's FTP server, or, additionally, edit the settings in this menu

### Properties

| Property | Description |
| :-- | :-- |
| **note** (*string*; Default: ) | Note that will be displayed. |
| **show-at-login** (*yes \| no*; Default: **yes**) | Whether to show the system note on each login |
| **show-at-cli-login** (*yes* \| *no*, Default: **no**) | Whether to show the system note before the telnet login prompt. |

### Example

It is possible to add multi-line notes using an embedded text editor (*`/system/note/edit` note*), for example, add ASCII art to your home router:

```
/system/note/set note=
```

```
                                       .&                                         
                                     @&   @&                                      
                                     @@   @#                                      
                                       @@&                                        
                                ,      @@@      .                                 
                                @@@@@@@@@@@@@@@@@                                 
                                       @@@                                        
                                       @@@                                        
                                       @@@                                        
                          ,@           @@@           &                            
                         @@@@          @@@          @@@@                          
                          @@           @@@           @(                           
                           &@@         @@@         @@@                            
                             @@@@@     @@@     &@@@&                              
                                &@@@@@@@@@@@@@@@&                                 
                                      @@@@@             
```
